import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { AUTH_CACHE_HEADERS } from "../.tmp/tests/lib/supabase/cache.js";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");
const origin = "https://finance.example.com";
const owner = { id: "owner-user-id", email: "owner@example.com" };
const callbackSource = readFileSync(new URL("../src/app/auth/callback/route.ts", import.meta.url), "utf8");
const callbackCode = ts.transpileModule(callbackSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS },
}).outputText;

// Exercise the actual route using real Next request/response objects and a
// provider whose public tables are unavailable, as in the reported RLS failure.
function createFixture({ user = owner, exchangeError = null } = {}) {
  const calls = { createClient: 0, codes: [], getUser: 0, signOut: 0, tables: [] };
  const provider = {
    auth: {
      async exchangeCodeForSession(code) {
        calls.codes.push(code);
        return { error: exchangeError };
      },
      async getUser() {
        calls.getUser += 1;
        return { data: { user } };
      },
      async signOut() {
        calls.signOut += 1;
        return { error: null };
      },
    },
    from(table) {
      calls.tables.push(table);
      throw new Error("Auth must not access public tables");
    },
  };
  const loadedModule = { exports: {} };
  const modules = {
    "@/lib/auth/allowlist": { isAllowedEmail: (email) => email === owner.email },
    "@/lib/supabase/server": {
      async createClient(headers) {
        calls.createClient += 1;
        assert.match(headers.get("cache-control"), /no-store/);
        return provider;
      },
    },
    "@/lib/supabase/cache": { AUTH_CACHE_HEADERS },
    "next/server": { NextResponse },
  };
  runInNewContext(callbackCode, {
    exports: loadedModule.exports,
    Headers,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected route dependency: ${name}`);
      return modules[name];
    },
  });
  return {
    calls,
    async invoke(params = { code: "recovery-code", next: "/auth/reset-password" }) {
      return loadedModule.exports.GET(new NextRequest(`${origin}/auth/callback?${new URLSearchParams(params)}`));
    },
  };
}

function assertRedirect(response, path) {
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), `${origin}${path}`);
  for (const [name, value] of Object.entries(AUTH_CACHE_HEADERS)) {
    assert.equal(response.headers.get(name), value);
  }
}

test("verified recovery reaches password reset without reading or writing profiles", async () => {
  const fixture = createFixture();
  assertRedirect(await fixture.invoke(), "/auth/reset-password");
  assert.deepEqual(fixture.calls.codes, ["recovery-code"]);
  assert.equal(fixture.calls.getUser, 1);
  assert.deepEqual(fixture.calls.tables, []);
  assert.equal(fixture.calls.signOut, 0);
});

test("normal callback reaches the dashboard without depending on a public profile", async () => {
  const fixture = createFixture();
  assertRedirect(await fixture.invoke({ code: "login-code" }), "/dashboard");
  assert.deepEqual(fixture.calls.codes, ["login-code"]);
  assert.equal(fixture.calls.getUser, 1);
  assert.deepEqual(fixture.calls.tables, []);
  assert.equal(fixture.calls.signOut, 0);
});

test("callbacks reject other accounts and missing users before redirecting", async () => {
  for (const user of [null, { id: "other-user-id", email: "other@example.com" }]) {
    for (const next of ["/auth/reset-password", "/dashboard"]) {
      const fixture = createFixture({ user });
      assertRedirect(await fixture.invoke({ code: "valid-code", next }), "/login?error=unauthorized");
      assert.equal(fixture.calls.signOut, 1);
      assert.deepEqual(fixture.calls.tables, []);
    }
  }
});

test("invalid PKCE codes cannot reach recovery or the dashboard", async () => {
  for (const next of ["/auth/reset-password", "/dashboard"]) {
    const fixture = createFixture({ exchangeError: { message: "Expired code" } });
    assertRedirect(await fixture.invoke({ code: "invalid-code", next }), "/login?error=auth_failed");
    assert.equal(fixture.calls.getUser, 0);
    assert.deepEqual(fixture.calls.tables, []);
  }
});

test("missing PKCE codes are rejected without creating an auth client", async () => {
  const fixture = createFixture();
  assertRedirect(await fixture.invoke({ next: "/auth/reset-password" }), "/login?error=missing_code");
  assert.equal(fixture.calls.createClient, 0);
});

test("only the exact reset path opens recovery, and other destinations stay on this origin", async () => {
  for (const next of [
    "https://attacker.example/auth/reset-password",
    "//attacker.example/auth/reset-password",
    "/auth/reset-password/",
    "/auth/reset-password?next=https://attacker.example",
    "/dashboard",
    "/settings",
  ]) {
    const fixture = createFixture();
    assertRedirect(await fixture.invoke({ code: "login-code", next }), "/dashboard");
    assert.deepEqual(fixture.calls.tables, []);
  }
});

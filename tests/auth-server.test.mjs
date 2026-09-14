import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { getAuthErrorMessage } from "../.tmp/tests/lib/auth/validation.js";
import { AUTH_CACHE_HEADERS } from "../.tmp/tests/lib/supabase/cache.js";

const owner = { id: "owner-user-id", email: "owner@example.com" };
const origin = "https://finance.example.com";
const providerSession = { user: owner, access_token: "test-access-token", refresh_token: "test-refresh-token" };
const serverCode = ts.transpileModule(readFileSync(new URL("../src/lib/auth/server.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS },
}).outputText;

function createFixture({
  allowedEmail = owner.email,
  user = owner,
  session = providerSession,
  loginError = null,
  recoveryError = null,
  updateError = null,
  signOutError = null,
} = {}) {
  const calls = { headers: [], signIn: [], recovery: [], getUser: 0, update: [], signOut: [], tables: [] };
  const provider = {
    auth: {
      async signInWithPassword(credentials) {
        calls.signIn.push(credentials);
        return { data: { session: loginError ? null : session }, error: loginError };
      },
      async resetPasswordForEmail(email, options) {
        calls.recovery.push({ email, options });
        return { error: recoveryError };
      },
      async getUser() {
        calls.getUser += 1;
        return { data: { user } };
      },
      async updateUser(attributes) {
        calls.update.push(attributes);
        return { error: updateError };
      },
      async signOut(options) {
        calls.signOut.push(options);
        return { error: signOutError };
      },
    },
    from(table) {
      calls.tables.push(table);
      throw new Error("Auth must not access public tables");
    },
  };
  const modules = {
    "@/lib/auth/allowlist": {
      isAllowedEmail: (email) => Boolean(allowedEmail?.trim()) && email?.trim().toLowerCase() === allowedEmail.trim().toLowerCase(),
    },
    "@/lib/auth/validation": { getAuthErrorMessage },
    "@/lib/supabase/server": {
      async createClient(headers) {
        calls.headers.push(headers);
        return provider;
      },
    },
  };
  const loadedModule = { exports: {} };
  runInNewContext(serverCode, {
    exports: loadedModule.exports,
    process: { env: { ALLOWED_EMAIL: allowedEmail } },
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected auth dependency: ${name}`);
      return modules[name];
    },
  });
  return { auth: loadedModule.exports, calls };
}

test("owner password sign-in returns the verified provider session without any profile access", async () => {
  const fixture = createFixture();
  const headers = new Headers(AUTH_CACHE_HEADERS);
  const result = await fixture.auth.submitAuthRequest({ action: "login", email: owner.email, password: "ExamplePass9!" }, origin, headers);
  assert.equal(result.ok, true);
  assert.deepEqual({ ...result.session }, { access_token: providerSession.access_token, refresh_token: providerSession.refresh_token });
  assert.equal(fixture.calls.signIn[0].email, owner.email);
  assert.equal(fixture.calls.signIn[0].password, "ExamplePass9!");
  assert.equal(fixture.calls.headers[0], headers);
  assert.deepEqual(fixture.calls.tables, []);
  assert.deepEqual(fixture.calls.signOut, []);
});

test("sign-in rejects unconfigured access and unapproved email before contacting Supabase", async () => {
  for (const allowedEmail of ["", "   ", "different@example.com"]) {
    const fixture = createFixture({ allowedEmail });
    const result = await fixture.auth.signInWithPassword(owner.email, "ExamplePass9!");
    assert.equal(result.ok, false);
    assert.match(result.error, allowedEmail.trim() ? /not authorized/ : /not configured/);
    assert.deepEqual(fixture.calls.headers, []);
    assert.deepEqual(fixture.calls.signIn, []);
  }
});

test("a provider session for another identity is signed out and never returned to the caller", async () => {
  const fixture = createFixture({ session: { ...providerSession, user: { id: "other", email: "other@example.com" } } });
  const result = await fixture.auth.signInWithPassword(owner.email, "ExamplePass9!");
  assert.equal(result.ok, false);
  assert.match(result.error, /not authorized/);
  assert.equal(result.session, undefined);
  assert.equal(fixture.calls.signOut.length, 1);
  assert.deepEqual(fixture.calls.tables, []);
});

test("password sign-in surfaces provider credential and confirmation errors without a profile fallback", async () => {
  for (const [code, message] of [["invalid_credentials", /Invalid login credentials/], ["email_not_confirmed", /Confirm your email/]]) {
    const fixture = createFixture({ loginError: { code, message: "Provider internal details" } });
    const result = await fixture.auth.signInWithPassword(owner.email, "ExamplePass9!");
    assert.equal(result.ok, false);
    assert.match(result.error, message);
    assert.equal(result.session, undefined);
    assert.deepEqual(fixture.calls.tables, []);
  }
});

test("forgot password uses the deployed recovery callback and does not require a profile", async () => {
  const fixture = createFixture();
  const headers = new Headers(AUTH_CACHE_HEADERS);
  const result = await fixture.auth.submitAuthRequest({ action: "forgot", email: owner.email }, origin, headers);
  assert.equal(result.ok, true);
  assert.match(result.message, /password reset link/);
  assert.equal(fixture.calls.recovery[0].email, owner.email);
  assert.equal(fixture.calls.recovery[0].options.redirectTo, `${origin}/auth/callback?next=/auth/reset-password`);
  assert.equal(fixture.calls.headers[0], headers);
  assert.deepEqual(fixture.calls.tables, []);
});

test("forgot password gives the same acknowledgement for unapproved emails without sending mail", async () => {
  const allowed = createFixture();
  const other = createFixture();
  const allowedResult = await allowed.auth.resetPasswordForEmail(owner.email, origin);
  const otherResult = await other.auth.resetPasswordForEmail("other@example.com", origin);
  assert.equal(otherResult.ok, true);
  assert.equal(otherResult.message, allowedResult.message);
  assert.deepEqual(other.calls.headers, []);
  assert.deepEqual(other.calls.recovery, []);
});

test("forgot password reports configuration and provider rate-limit errors", async () => {
  const unconfigured = createFixture({ allowedEmail: "" });
  const unavailable = await unconfigured.auth.resetPasswordForEmail(owner.email, origin);
  assert.equal(unavailable.ok, false);
  assert.match(unavailable.error, /not configured/);
  assert.deepEqual(unconfigured.calls.recovery, []);
  const limited = createFixture({ recoveryError: { code: "over_email_send_rate_limit", message: "Rate limit" } });
  const result = await limited.auth.resetPasswordForEmail(owner.email, origin);
  assert.equal(result.ok, false);
  assert.match(result.error, /Too many emails/);
});

test("password update verifies the owner and ends only the local session without touching profiles", async () => {
  const fixture = createFixture();
  const headers = new Headers(AUTH_CACHE_HEADERS);
  const result = await fixture.auth.submitAuthRequest({ action: "reset", password: "ReplacementPass9!" }, origin, headers);
  assert.equal(result.ok, true);
  assert.match(result.message, /Password updated/);
  assert.equal(fixture.calls.getUser, 1);
  assert.equal(fixture.calls.update[0].password, "ReplacementPass9!");
  assert.equal(fixture.calls.signOut[0].scope, "local");
  assert.equal(fixture.calls.headers[0], headers);
  assert.deepEqual(fixture.calls.tables, []);
});

test("missing or unauthorized recovery sessions cannot change a password", async () => {
  for (const user of [null, { id: "other", email: "other@example.com" }]) {
    const fixture = createFixture({ user });
    const result = await fixture.auth.updatePassword("ReplacementPass9!");
    assert.equal(result.ok, false);
    assert.match(result.error, /reset link has expired/);
    assert.equal(fixture.calls.getUser, 1);
    assert.deepEqual(fixture.calls.update, []);
    assert.deepEqual(fixture.calls.tables, []);
  }
});

test("a rejected new password keeps the session available for another attempt", async () => {
  const fixture = createFixture({ updateError: { code: "weak_password", message: "Weak password" } });
  const result = await fixture.auth.updatePassword("ReplacementPass9!");
  assert.equal(result.ok, false);
  assert.match(result.error, /stronger password/);
  assert.deepEqual(fixture.calls.signOut, []);
});

test("a logout failure after password update accurately reports that the password changed", async () => {
  const fixture = createFixture({ signOutError: { message: "Network error" } });
  const result = await fixture.auth.updatePassword("ReplacementPass9!");
  assert.equal(result.ok, false);
  assert.match(result.error, /password was updated/);
  assert.match(result.error, /couldn't end this session/);
  assert.equal(fixture.calls.update.length, 1);
});

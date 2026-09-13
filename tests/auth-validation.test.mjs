import assert from "node:assert/strict";
import test from "node:test";
import {
  authRequestSchema,
  emailSchema,
  getAuthErrorMessage,
  getFieldErrors,
  loginSchema,
  securePasswordSchema,
} from "../.tmp/tests/lib/auth/validation.js";

test("emails are normalized before login or password reset", () => {
  assert.equal(emailSchema.parse("  Owner@Example.COM  "), "owner@example.com");
});

test("emails with embedded controls, invalid syntax, or excessive length are rejected", () => {
  for (const email of ["owner\n@example.com", "owner@example", "<script>@example.com", `${"a".repeat(250)}@example.com`]) {
    assert.equal(emailSchema.safeParse(email).success, false, email);
  }
});

test("password characters including surrounding whitespace are preserved", () => {
  const password = "  StrongPass9!  ";
  assert.equal(securePasswordSchema.parse(password), password);
});

test("a reset password requires all password rules", () => {
  const invalid = ["Aa1!", "PASSWORD1!", "password1!", "Password!!", "Password12", "Password1 ", `Aa1!${"x".repeat(125)}`];
  for (const password of invalid) assert.equal(securePasswordSchema.safeParse(password).success, false, password);
  assert.equal(securePasswordSchema.safeParse("Asecure1!").success, true);
});

test("login permits existing passwords without requiring the new signup complexity", () => {
  assert.equal(loginSchema.safeParse({ email: "owner@example.com", password: "oldpassword" }).success, true);
  assert.equal(loginSchema.safeParse({ email: "owner@example.com", password: "short" }).success, false);
});

test("forgot password needs only a valid email and reset requires a strong password", () => {
  assert.deepEqual(authRequestSchema.parse({ action: "forgot", email: " OWNER@example.com " }), { action: "forgot", email: "owner@example.com" });
  assert.equal(authRequestSchema.safeParse({ action: "reset", password: "Asecure1!" }).success, true);
  assert.equal(authRequestSchema.safeParse({ action: "reset", password: "weakpass" }).success, false);
});

test("unknown auth actions and malformed requests are rejected", () => {
  for (const input of [null, {}, { action: "magic-link", email: "owner@example.com" }, { action: "login", password: 12345678 }]) {
    assert.equal(authRequestSchema.safeParse(input).success, false);
  }
});

test("field errors report the first actionable failure without credentials", () => {
  const parsed = loginSchema.safeParse({ email: "bad", password: "x" });
  assert.equal(parsed.success, false);
  assert.deepEqual(getFieldErrors(parsed.error), { email: "Enter a valid email address.", password: "Use at least 8 characters." });
});

test("provider errors become useful messages without exposing internal failures", () => {
  assert.match(getAuthErrorMessage({ code: "invalid_credentials", message: "internal" }), /Invalid login credentials/);
  assert.match(getAuthErrorMessage({ code: "email_not_confirmed", message: "internal" }), /Confirm your email/);
  assert.equal(getAuthErrorMessage({ code: "unknown", message: "internal secret" }).includes("internal secret"), false);
});

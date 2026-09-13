import assert from "node:assert/strict";
import test from "node:test";
import { parseAmountMinor, transactionInputSchema } from "./validation";

test("decimal parsing retains cents without floating point multiplication", () => {
  assert.equal(parseAmountMinor("0.29"), 29);
  assert.equal(parseAmountMinor(" 100.5 "), 10050);
  assert.equal(parseAmountMinor("90071992547409.91"), Number.MAX_SAFE_INTEGER);
});

test("decimal parsing rejects negative, exponent, zero, excess precision, and unsafe values", () => {
  for (const amount of ["-10", "1e3", "NaN", "Infinity", "0", "0.00", "1.999", "90071992547409.92", "1,000.00"]) {
    assert.equal(parseAmountMinor(amount), null, amount);
  }
});

test("transaction schema trims titles and rejects invalid dates and unsupported currencies", () => {
  const input = { title: "  Coffee  ", amount: "5.50", date: "2026-09-13", type: "expense", currency: "USD" };
  assert.equal(transactionInputSchema.parse(input).title, "Coffee");
  assert.equal(transactionInputSchema.safeParse({ ...input, date: "2026-02-30" }).success, false);
  assert.equal(transactionInputSchema.safeParse({ ...input, currency: "JPY" }).success, false);
  assert.equal(transactionInputSchema.safeParse({ ...input, title: " " }).success, false);
});

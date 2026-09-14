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

const WALLET_A = "11111111-1111-4111-8111-111111111111";
const WALLET_B = "22222222-2222-4222-8222-222222222222";

test("transaction schema trims notes and rejects invalid dates and types", () => {
  const input = { walletId: WALLET_A, amount: "5.50", date: "2026-09-13", type: "expense", note: "  Coffee  " };
  assert.equal(transactionInputSchema.parse(input).note, "Coffee");
  assert.equal(transactionInputSchema.safeParse({ ...input, date: "2026-02-30" }).success, false);
  assert.equal(transactionInputSchema.safeParse({ ...input, type: "withdrawal" }).success, false);
  assert.equal(transactionInputSchema.safeParse({ ...input, walletId: "not-a-uuid" }).success, false);
});

test("transfers require a destination wallet different from the source", () => {
  const input = { walletId: WALLET_A, amount: "5.50", date: "2026-09-13", type: "transfer" as const };
  assert.equal(transactionInputSchema.safeParse(input).success, false);
  assert.equal(transactionInputSchema.safeParse({ ...input, destinationWalletId: WALLET_A }).success, false);
  assert.equal(transactionInputSchema.safeParse({ ...input, destinationWalletId: WALLET_B }).success, true);
});

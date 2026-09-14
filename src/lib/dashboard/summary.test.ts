import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, getPeriodStart, isValidDate, summarizeTransactions } from "./summary";
import type { Transaction } from "./types";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return { id: "test", title: "Test", date: "2026-09-13", amountMinor: 100, currency: "USD", type: "expense", walletId: "wallet-1", ...overrides };
}

test("totals never combine different currencies or future and out-of-period entries", () => {
  const summary = summarizeTransactions([
    transaction({ type: "income", amountMinor: 2500 }),
    transaction({ amountMinor: 29 }),
    transaction({ amountMinor: 100000, currency: "EUR" }),
    transaction({ amountMinor: 100000, date: "2025-09-30" }),
    transaction({ amountMinor: 100000, date: "2026-09-14" }),
  ], "USD", "2026-09-13");
  assert.equal(summary.incomeMinor, 2500);
  assert.equal(summary.expensesMinor, 29);
  assert.equal(summary.balanceMinor, 2471);
  assert.equal(summary.monthlyPoints.length, 12);
  assert.deepEqual(summary.monthlyPoints[11], { label: "Sep", amountMinor: 29 });
});

test("monthly spending handles year boundaries and fills missing months", () => {
  assert.equal(getPeriodStart("2026-01-31"), "2025-02-01");
  const summary = summarizeTransactions([
    transaction({ date: "2025-12-31", amountMinor: 123 }),
    transaction({ date: "2026-01-01", amountMinor: 456 }),
  ], "USD", "2026-01-31");
  assert.deepEqual(summary.monthlyPoints[0], { label: "Feb", amountMinor: 0 });
  assert.deepEqual(summary.monthlyPoints[10], { label: "Dec", amountMinor: 123 });
  assert.deepEqual(summary.monthlyPoints[11], { label: "Jan", amountMinor: 456 });
});

test("invalid ledger magnitudes and unsafe aggregate totals fail explicitly", () => {
  assert.throws(() => summarizeTransactions([transaction({ amountMinor: -1 })], "USD", "2026-09-13"), RangeError);
  assert.throws(() => summarizeTransactions([
    transaction({ amountMinor: Number.MAX_SAFE_INTEGER }), transaction({ amountMinor: 1 }),
  ], "USD", "2026-09-13"), RangeError);
});

test("money formatting preserves exact cents and debit signs", () => {
  assert.equal(formatMoney(2688709, "USD"), "$26,887.09");
  assert.equal(formatMoney(-29, "USD"), "-$0.29");
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
});

test("calendar validation rejects rollover dates and accepts leap days", () => {
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2024-02-29"), true);
});

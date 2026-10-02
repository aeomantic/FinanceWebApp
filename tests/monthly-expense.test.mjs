import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const exports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/monthly-expense.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { calculateMonthlySpend: forecast, initialBillDueDate } = exports;
const bill = { amount: 12.34, currency: 'SGD', next_due_date: '2026-09-30' };
const expense = { amountMinor: 500, currency: 'SGD', type: 'expense', date: '2026-09-01' };
const bnpl = { amountMinor: 1000, currency: 'SGD', isActive: true, obligationType: 'bnpl', paidInstallments: 2, totalInstallments: 3, nextDueOn: '2026-09-30' };

test('forecast excludes next month, other currencies, income, transfers and completed BNPL', () => {
  const f = forecast([expense, { ...expense, type: 'income' }, { ...expense, type: 'transfer' }, { ...expense, currency: 'USD' }], [bill, { ...bill, next_due_date: '2026-10-01' }, { ...bill, currency: 'USD' }], [bnpl, { ...bnpl, isActive: false }, { ...bnpl, paidInstallments: 3 }, { ...bnpl, nextDueOn: '2026-10-01' }, { ...bnpl, obligationType: 'subscription' }], '2026-09', 'SGD');
  assert.equal(f.actualSpent, 500); assert.equal(f.pendingBillsTotal, 1234); assert.equal(f.pendingBNPLTotal, 1000);
  assert.equal(f.totalProjectedSpend, 2734); assert.equal(f.billsCount, 1); assert.equal(f.bnplCount, 1);
});
test('payment moves the current bill into spent without double counting', () => {
  const before = forecast([expense], [bill], [], '2026-09', 'SGD');
  const after = forecast([expense, { ...expense, amountMinor: 1234 }], [{ ...bill, next_due_date: '2026-10-30', last_paid_date: '2026-09-30' }], [], '2026-09', 'SGD');
  assert.equal(before.totalProjectedSpend, after.totalProjectedSpend);
  assert.equal(after.pendingBillsTotal, 0); assert.equal(after.actualSpent, 1734);
});
test('initial due dates clamp month ends, keep today and advance past days', () => {
  assert.equal(initialBillDueDate(31, '2024-02-01'), '2024-02-29');
  assert.equal(initialBillDueDate(31, '2026-02-01'), '2026-02-28');
  assert.equal(initialBillDueDate(30, '2026-09-30'), '2026-09-30');
  assert.equal(initialBillDueDate(1, '2026-12-30'), '2027-01-01');
  assert.equal(forecast([], [], [], '2026-09', 'SGD').totalProjectedSpend, 0);
});

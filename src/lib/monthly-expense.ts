import type { Bill } from "./bills/types";
import type { Commitment } from "./commitments/types";
import type { Transaction } from "./dashboard/types";

/** Monetary totals are in minor units, matching the ledger and formatMoney. */
export interface MonthlySpendForecast {
  actualSpent: number;
  pendingBillsTotal: number;
  pendingBNPLTotal: number;
  totalProjectedSpend: number;
  billsCount: number;
  bnplCount: number;
}

export function calculateMonthlySpend(transactions: Transaction[], bills: Bill[], commitments: Commitment[], month: string, currency: string): MonthlySpendForecast {
  const pendingBills = bills.filter(b => b.currency === currency && b.next_due_date.slice(0, 7) === month.slice(0, 7));
  const pendingBNPL = commitments.filter(c => c.currency === currency && c.isActive && c.obligationType === "bnpl" && c.paidInstallments < (c.totalInstallments ?? 0) && c.nextDueOn.slice(0, 7) === month.slice(0, 7));
  const actualSpent = transactions.filter(t => t.type === "expense" && t.currency === currency && t.date.slice(0, 7) === month.slice(0, 7)).reduce((sum, t) => sum + t.amountMinor, 0);
  const pendingBillsTotal = pendingBills.reduce((sum, b) => sum + Math.round(b.amount * 100), 0);
  const pendingBNPLTotal = pendingBNPL.reduce((sum, c) => sum + c.amountMinor, 0);
  return { actualSpent, pendingBillsTotal, pendingBNPLTotal, totalProjectedSpend: actualSpent + pendingBillsTotal + pendingBNPLTotal, billsCount: pendingBills.length, bnplCount: pendingBNPL.length };
}

export function initialBillDueDate(day: number, today: string): string {
  const date = new Date(`${today}T12:00:00Z`);
  function candidate(offset: number) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
    const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    start.setUTCDate(Math.min(day, last));
    return start.toISOString().slice(0, 10);
  }
  const current = candidate(0);
  return current >= today ? current : candidate(1);
}

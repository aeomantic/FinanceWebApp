import type { MonthlySpendPoint, Transaction } from "./types";

/** Fictional sample activity for the explicitly labeled design preview only. */
export const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "demo-eva", title: "Eva Novak", date: "2026-09-13", amountMinor: 571020, currency: "USD", type: "income", category: "Personal" },
  { id: "demo-binance", title: "Binance", date: "2026-09-13", amountMinor: 71400, currency: "USD", type: "income", category: "Investment" },
  { id: "demo-henrik", title: "Henrik Jansen", date: "2026-09-12", amountMinor: 42800, currency: "USD", type: "income", category: "Personal" },
  { id: "demo-multiplex", title: "Multiplex", date: "2026-09-12", amountMinor: 12455, currency: "USD", type: "expense", category: "Entertainment" },
  { id: "demo-spotify", title: "Spotify Premium", date: "2026-09-12", amountMinor: 1099, currency: "USD", type: "expense", category: "Subscription" },
  { id: "demo-coffee", title: "% Arabica", date: "2026-09-11", amountMinor: 650, currency: "USD", type: "expense", category: "Food & drink" },
];

export const DEMO_MONTHLY_POINTS: MonthlySpendPoint[] = [
  { label: "Jan", amountMinor: 842520 }, { label: "Feb", amountMinor: 634920 },
  { label: "Mar", amountMinor: 953740 }, { label: "Apr", amountMinor: 785620 },
  { label: "May", amountMinor: 1289020 }, { label: "Jun", amountMinor: 1068530 },
  { label: "Jul", amountMinor: 864020 }, { label: "Aug", amountMinor: 1347860 },
  { label: "Sep", amountMinor: 1089930 }, { label: "Oct", amountMinor: 787640 },
  { label: "Nov", amountMinor: 915420 }, { label: "Dec", amountMinor: 1316014 },
];

export function getDemoTransactions(today: string): Transaction[] {
  const reference = Date.parse("2026-09-13T00:00:00.000Z");
  const target = Date.parse(`${today}T00:00:00.000Z`);
  return DEMO_TRANSACTIONS.map((transaction) => ({
    ...transaction,
    date: new Date(Date.parse(`${transaction.date}T00:00:00.000Z`) + target - reference).toISOString().slice(0, 10),
  }));
}

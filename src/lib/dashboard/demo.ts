import type { MonthlySpendPoint, Transaction, Wallet } from "./types";

/** Fictional sample wallets and activity for the explicitly labeled design preview only. */
export const DEMO_WALLETS: Wallet[] = [
  { id: "demo-main", name: "Everyday", currency: "USD", balanceMinor: 2688709, color: "mint", isDefault: true },
  { id: "demo-food", name: "Food & Groceries", currency: "USD", balanceMinor: 42150, color: "peach", isDefault: false },
  { id: "demo-bills", name: "Bills", currency: "USD", balanceMinor: 128000, color: "blue", isDefault: false },
];

export const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "demo-eva", title: "Personal", date: "2026-09-13", amountMinor: 571020, currency: "USD", type: "income", category: "Personal", walletId: "demo-main" },
  { id: "demo-binance", title: "Investment", date: "2026-09-13", amountMinor: 71400, currency: "USD", type: "income", category: "Investment", walletId: "demo-main" },
  { id: "demo-henrik", title: "Personal", date: "2026-09-12", amountMinor: 42800, currency: "USD", type: "income", category: "Personal", walletId: "demo-main" },
  { id: "demo-multiplex", title: "Entertainment", date: "2026-09-12", amountMinor: 12455, currency: "USD", type: "expense", category: "Entertainment", walletId: "demo-main" },
  { id: "demo-spotify", title: "Subscription", date: "2026-09-12", amountMinor: 1099, currency: "USD", type: "expense", category: "Subscription", walletId: "demo-bills" },
  { id: "demo-coffee", title: "Food & drink", date: "2026-09-11", amountMinor: 650, currency: "USD", type: "expense", category: "Food & drink", walletId: "demo-food" },
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

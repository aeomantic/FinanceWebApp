export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  title: string;
  date: string;
  amountMinor: number;
  currency: string;
  type: TransactionType;
  category?: string;
}

export interface MonthlySpendPoint {
  label: string;
  amountMinor: number;
}

export interface CurrencySummary {
  currency: string;
  /** Net recorded activity within the displayed period, not a bank balance. */
  balanceMinor: number;
  incomeMinor: number;
  expensesMinor: number;
  monthlyPoints: MonthlySpendPoint[];
}

export interface DashboardData {
  transactions: Transaction[];
  today: string;
  periodStart: string;
  name: string;
  email: string;
  error: string | null;
}

export interface RecordTransactionInput {
  title: string;
  amount: string;
  currency: string;
  date: string;
  type: TransactionType;
}

export type RecordTransactionResult =
  | { success: true }
  | { success: false; error: string };

export type TransactionType = "income" | "expense" | "transfer";

export interface Wallet {
  id: string;
  name: string;
  currency: string;
  balanceMinor: number;
  color: string | null;
  isDefault: boolean;
}

export type CategoryType = "expense" | "income";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
}

export interface Transaction {
  id: string;
  title: string;
  date: string;
  amountMinor: number;
  currency: string;
  type: TransactionType;
  category?: string;
  walletId: string;
  destinationWalletId?: string;
  note?: string;
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
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  today: string;
  periodStart: string;
  name: string;
  email: string;
  error: string | null;
}

export interface RecordTransactionInput {
  walletId: string;
  destinationWalletId?: string;
  categoryId?: string;
  amount: string;
  date: string;
  type: TransactionType;
  note?: string;
}

export type RecordTransactionResult =
  | { success: true }
  | { success: false; error: string };

export interface CreateWalletInput {
  name: string;
  currency: string;
  color?: string;
}

export type CreateWalletResult =
  | { success: true; wallet: Wallet }
  | { success: false; error: string };

export type SetDefaultWalletResult =
  | { success: true }
  | { success: false; error: string };

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  icon?: string;
}

export type CreateCategoryResult =
  | { success: true; category: Category }
  | { success: false; error: string };

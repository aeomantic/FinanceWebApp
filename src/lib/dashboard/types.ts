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
  /** The date-only day the owner assigned to this movement (`occurred_on`). */
  date: string;
  amountMinor: number;
  currency: string;
  type: TransactionType;
  category?: string;
  categoryId?: string;
  categoryIcon?: string;
  walletId: string;
  destinationWalletId?: string;
  note?: string;
  /** When the row was actually written (`created_at`). Absent on demo data. */
  recordedAt?: string;
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

export interface UpdateTransactionInput extends RecordTransactionInput {
  id: string;
}

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

export interface RenameWalletInput {
  walletId: string;
  name: string;
}

export type RenameWalletResult =
  | { success: true; name: string }
  | { success: false; error: string };

export type DeleteWalletResult =
  | { success: true }
  // code/detail carry the raw Postgres error (safe schema-level data, never a
  // payload or token) so the delete dialog can log it for diagnosis when the
  // friendly message is not enough.
  | { success: false; error: string; code?: string; detail?: string };

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  icon?: string;
}

export type CreateCategoryResult =
  | { success: true; category: Category }
  | { success: false; error: string };

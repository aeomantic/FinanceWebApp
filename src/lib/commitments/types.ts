import type { Category, Wallet } from "@/lib/dashboard/types";

export type ObligationType = "subscription" | "bnpl";
export type BillingFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "custom_months";

export interface Commitment {
  id: string;
  name: string;
  amountMinor: number;
  currency: string;
  walletId: string | null;
  categoryId: string | null;
  obligationType: ObligationType;
  frequency: BillingFrequency;
  intervalCount: number;
  anchorDate: string;
  nextDueOn: string;
  totalInstallments: number | null;
  paidInstallments: number;
  endDate: string | null;
  icon: string;
  isActive: boolean;
  updatedAt: string;
}

export interface CommitmentInput {
  id?: string;
  updatedAt?: string;
  name: string;
  amount: string;
  walletId: string;
  categoryId?: string;
  obligationType: ObligationType;
  frequency: BillingFrequency;
  intervalCount: number;
  nextDueOn: string;
  totalInstallments?: number;
  paidInstallments: number;
  endDate?: string;
  icon: string;
}

export type CommitmentResult = { success: true } | { success: false; error: string };
export interface CommitmentsData {
  commitments: Commitment[];
  wallets: Wallet[];
  categories: Category[];
  today: string;
  name: string;
  error: string | null;
}

"use server";

import { revalidatePath } from "next/cache";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { categoryInputSchema, parseAmountMinor, transactionInputSchema, walletInputSchema } from "@/lib/dashboard/validation";
import type {
  CreateCategoryInput,
  CreateCategoryResult,
  CreateWalletInput,
  CreateWalletResult,
  RecordTransactionInput,
  RecordTransactionResult,
} from "@/lib/dashboard/types";

/** Record ledger activity. This action never sends money or performs a bank transfer. */
export async function recordTransaction(input: RecordTransactionInput): Promise<RecordTransactionResult> {
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the transaction details." };
  if (parsed.data.date > new Date().toISOString().slice(0, 10)) {
    return { success: false, error: "Choose today or an earlier transaction date." };
  }

  const amountMinor = parseAmountMinor(parsed.data.amount);
  if (amountMinor === null) return { success: false, error: "Enter a valid transaction amount." };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) {
      return { success: false, error: "Your session has expired. Please sign in again." };
    }

    const { data: wallet, error: walletError } = await supabase
      .from("wallets").select("id,currency").eq("id", parsed.data.walletId).single();
    if (walletError || !wallet) return { success: false, error: "That wallet could not be found." };

    // amount_minor is a positive magnitude; type and wallet_id/destination_wallet_id
    // determine direction. The database trigger keeps wallet balances in sync.
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      wallet_id: parsed.data.walletId,
      destination_wallet_id: parsed.data.destinationWalletId ?? null,
      category_id: parsed.data.categoryId ?? null,
      amount_minor: amountMinor,
      currency: wallet.currency,
      occurred_on: parsed.data.date,
      type: parsed.data.type,
      note: parsed.data.note ?? null,
    });
    if (error) return { success: false, error: "We couldn't save this transaction. Please try again." };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function createWallet(input: CreateWalletInput): Promise<CreateWalletResult> {
  const parsed = walletInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the wallet details." };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) {
      return { success: false, error: "Your session has expired. Please sign in again." };
    }

    const { data, error } = await supabase.from("wallets").insert({
      user_id: user.id,
      name: parsed.data.name,
      currency: parsed.data.currency,
      color: parsed.data.color ?? null,
    }).select("id,name,currency,balance_minor,color").single();

    if (error || !data) return { success: false, error: "We couldn't create this wallet. Please try again." };

    revalidatePath("/dashboard");
    return { success: true, wallet: { id: data.id, name: data.name, currency: data.currency, balanceMinor: data.balance_minor, color: data.color } };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }
}

export async function createCategory(input: CreateCategoryInput): Promise<CreateCategoryResult> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the category details." };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) {
      return { success: false, error: "Your session has expired. Please sign in again." };
    }

    const { data, error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      icon: parsed.data.icon ?? null,
    }).select("id,name,type,icon,color").single();

    if (error || !data) return { success: false, error: "We couldn't create this category. Please try again." };

    revalidatePath("/dashboard");
    return { success: true, category: { id: data.id, name: data.name, type: data.type, icon: data.icon, color: data.color } };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }
}

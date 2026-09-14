"use server";

import { revalidatePath } from "next/cache";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { categoryInputSchema, parseAmountMinor, renameWalletInputSchema, transactionInputSchema, uuidSchema, walletInputSchema } from "@/lib/dashboard/validation";
import type {
  CreateCategoryInput,
  CreateCategoryResult,
  CreateWalletInput,
  CreateWalletResult,
  DeleteWalletResult,
  RecordTransactionInput,
  RecordTransactionResult,
  RenameWalletInput,
  RenameWalletResult,
  SetDefaultWalletResult,
} from "@/lib/dashboard/types";
import type { PostgrestError } from "@supabase/supabase-js";

// Postgrest errors carry a code/message/details/hint that are safe to log
// (schema-level detail, never the request payload or a token) but useful
// for diagnosing RLS/constraint failures that only show up against the
// live database, not in local dev.
function logDbError(context: string, error: PostgrestError) {
  console.error(context, { code: error.code, message: error.message, details: error.details, hint: error.hint });
}

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
    if (walletError || !wallet) {
      if (walletError) logDbError("Wallet lookup failed:", walletError);
      return { success: false, error: "That wallet could not be found." };
    }

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
    if (error) {
      logDbError("Transaction insert failed:", error);
      return { success: false, error: "We couldn't save this transaction. Please try again." };
    }
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

    const { count: existingWallets, error: countError } = await supabase
      .from("wallets").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if (countError) {
      logDbError("Wallet count failed:", countError);
      return { success: false, error: "We couldn't create this wallet. Please try again." };
    }

    // The first wallet a user creates becomes their default automatically.
    const { data, error } = await supabase.from("wallets").insert({
      user_id: user.id,
      name: parsed.data.name,
      currency: parsed.data.currency,
      color: parsed.data.color ?? null,
      is_default: existingWallets === 0,
    }).select("id,name,currency,balance_minor,color,is_default").single();

    if (error || !data) {
      if (error) logDbError("Wallet insert failed:", error);
      return { success: false, error: "We couldn't create this wallet. Please try again." };
    }

    revalidatePath("/dashboard");
    return { success: true, wallet: { id: data.id, name: data.name, currency: data.currency, balanceMinor: data.balance_minor, color: data.color, isDefault: data.is_default } };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }
}

export async function setDefaultWallet(walletId: string): Promise<SetDefaultWalletResult> {
  if (!uuidSchema.safeParse(walletId).success) return { success: false, error: "That wallet could not be found." };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) {
      return { success: false, error: "Your session has expired. Please sign in again." };
    }

    // The partial unique index on wallets only allows one is_default = true
    // row per user, so the old default must be cleared before the new one
    // is set - clearing first never violates it, since zero defaults is fine.
    const { error: clearError } = await supabase.from("wallets").update({ is_default: false }).eq("user_id", user.id);
    if (clearError) {
      logDbError("Clearing default wallet failed:", clearError);
      return { success: false, error: "We couldn't update your default wallet. Please try again." };
    }

    const { error: setError, count } = await supabase
      .from("wallets").update({ is_default: true }, { count: "exact" }).eq("id", walletId).eq("user_id", user.id);
    if (setError || !count) {
      if (setError) logDbError("Setting default wallet failed:", setError);
      return { success: false, error: "That wallet could not be found." };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }
}

export async function renameWallet(input: RenameWalletInput): Promise<RenameWalletResult> {
  const parsed = renameWalletInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the wallet name." };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) {
      return { success: false, error: "Your session has expired. Please sign in again." };
    }

    const { error, count } = await supabase
      .from("wallets").update({ name: parsed.data.name }, { count: "exact" }).eq("id", parsed.data.walletId).eq("user_id", user.id);
    if (error || !count) {
      if (error) logDbError("Wallet rename failed:", error);
      return { success: false, error: "That wallet could not be found." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/wallets");
    return { success: true, name: parsed.data.name };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }
}

export async function deleteWallet(walletId: string): Promise<DeleteWalletResult> {
  if (!uuidSchema.safeParse(walletId).success) return { success: false, error: "That wallet could not be found." };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) {
      return { success: false, error: "Your session has expired. Please sign in again." };
    }

    const { data: allWallets, error: listError } = await supabase
      .from("wallets").select("id,is_default").eq("user_id", user.id).order("created_at", { ascending: true });
    if (listError) {
      logDbError("Wallet list failed:", listError);
      return { success: false, error: "We couldn't delete this wallet. Please try again." };
    }

    const target = allWallets?.find((wallet) => wallet.id === walletId);
    if (!target) return { success: false, error: "That wallet could not be found." };
    if (allWallets.length === 1) {
      return { success: false, error: "You need at least one wallet. Create another before deleting this one." };
    }

    // Deleting the default wallet needs a new one promoted first, since the
    // app assumes a default always exists once any wallet does.
    if (target.is_default) {
      const nextDefault = allWallets.find((wallet) => wallet.id !== walletId);
      if (nextDefault) {
        const { error: promoteError } = await supabase.from("wallets").update({ is_default: true }).eq("id", nextDefault.id).eq("user_id", user.id);
        if (promoteError) {
          logDbError("Promoting fallback default wallet failed:", promoteError);
          return { success: false, error: "We couldn't delete this wallet. Please try again." };
        }
      }
    }

    // Cascades to delete every transaction recorded against this wallet
    // (transactions.wallet_id is ON DELETE CASCADE) - the confirmation UI
    // must make that permanence clear before calling this.
    const { error: deleteError, count } = await supabase
      .from("wallets").delete({ count: "exact" }).eq("id", walletId).eq("user_id", user.id);
    if (deleteError || !count) {
      if (deleteError) logDbError("Wallet delete failed:", deleteError);
      return { success: false, error: "We couldn't delete this wallet. Please try again." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/wallets");
    return { success: true };
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

    if (error || !data) {
      if (error) logDbError("Category insert failed:", error);
      return { success: false, error: "We couldn't create this category. Please try again." };
    }

    revalidatePath("/dashboard");
    return { success: true, category: { id: data.id, name: data.name, type: data.type, icon: data.icon, color: data.color } };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }
}

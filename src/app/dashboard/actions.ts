"use server";

import { revalidatePath } from "next/cache";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { categoryInputSchema, parseAmountMinor, renameWalletInputSchema, transactionInputSchema, updateTransactionInputSchema, uuidSchema, walletInputSchema } from "@/lib/dashboard/validation";
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
  UpdateTransactionInput,
} from "@/lib/dashboard/types";
import type { PostgrestError } from "@supabase/supabase-js";

// Postgrest errors carry a code/message/details/hint that are safe to log
// (schema-level detail, never the request payload or a token) but useful
// for diagnosing RLS/constraint failures that only show up against the
// live database, not in local dev.
function logDbError(context: string, error: PostgrestError) {
  console.error(context, { code: error.code, message: error.message, details: error.details, hint: error.hint });
}

function refreshDashboardPages() {
  for (const path of ["/dashboard", "/settings", "/transactions", "/wallets", "/commitments"]) revalidatePath(path);
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

  refreshDashboardPages();
  return { success: true };
}

/** Correct an existing ledger entry. The sync_wallet_balance trigger reverses
 * the old row's effect and applies the new one on UPDATE, so amount, date,
 * wallet, and destination changes rebalance every touched wallet without any
 * client-side delta arithmetic. */
export async function updateTransaction(input: UpdateTransactionInput): Promise<RecordTransactionResult> {
  const parsed = updateTransactionInputSchema.safeParse(input);
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

    // Currency always follows the (possibly reassigned) source wallet, the
    // same rule recordTransaction applies on insert.
    const { data: wallet, error: walletError } = await supabase
      .from("wallets").select("id,currency").eq("id", parsed.data.walletId).single();
    if (walletError || !wallet) {
      if (walletError) logDbError("Wallet lookup failed:", walletError);
      return { success: false, error: "That wallet could not be found." };
    }

    const { error, count } = await supabase.from("transactions").update({
      wallet_id: parsed.data.walletId,
      destination_wallet_id: parsed.data.destinationWalletId ?? null,
      category_id: parsed.data.categoryId ?? null,
      amount_minor: amountMinor,
      currency: wallet.currency,
      occurred_on: parsed.data.date,
      type: parsed.data.type,
      note: parsed.data.note ?? null,
    }, { count: "exact" }).eq("id", parsed.data.id).eq("user_id", user.id);
    if (error) {
      logDbError("Transaction update failed:", error);
      return { success: false, error: "We couldn't save your changes. Please try again." };
    }
    if (!count) return { success: false, error: "That transaction could not be found. Refresh and try again." };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }

  refreshDashboardPages();
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

    refreshDashboardPages();
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

    const { error } = await supabase.rpc("set_default_wallet", { p_wallet_id: walletId });
    if (error) {
      logDbError("Setting default wallet failed:", error);
      return { success: false, error: error.code === "P0002" ? "That wallet could not be found." : "We couldn't update your default wallet. Please try again." };
    }

    refreshDashboardPages();
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

    refreshDashboardPages();
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

    // Atomic, SECURITY DEFINER RPC: does all unlinking, transaction cleanup,
    // deletion, and default promotion in one transaction (see
    // 20260918030000_delete_wallet_safely.sql). Returns jsonb {success,error}
    // for handled cases (e.g. only-wallet) and raises for auth/ownership.
    const { data, error } = await supabase.rpc("delete_wallet_safely", { target_wallet_id: walletId });
    if (error) {
      logDbError("Wallet delete failed:", error);
      // Surface the exact database error. If a constraint or RLS block ever
      // remains, its message (e.g. the offending constraint name in a 23503)
      // reaches the UI and the console instead of being hidden behind a shrug.
      return { success: false, code: error.code, detail: error.message,
        error: error.message?.trim() || "We couldn't delete this wallet. Please refresh and try again." };
    }
    // Handled, non-raising failures come back as {success:false,error} jsonb.
    const result = (data ?? null) as { success?: boolean; error?: string } | null;
    if (result && result.success === false) {
      return { success: false, error: result.error?.trim() || "We couldn't delete this wallet. Please refresh and try again." };
    }

    refreshDashboardPages();
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

    refreshDashboardPages();
    return { success: true, category: { id: data.id, name: data.name, type: data.type, icon: data.icon, color: data.color } };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }
}

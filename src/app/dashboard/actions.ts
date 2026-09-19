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
  let cleanupStarted = false;
  const failure = (): DeleteWalletResult => ({ success: false, error: cleanupStarted
    ? "We couldn't finish deleting this wallet. Some changes may already be saved. Refresh and try again."
    : "We couldn't delete this wallet. Please refresh and try again." });
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) {
      return { success: false, error: "Your session has expired. Please sign in again." };
    }
    // The old RPC's empty search_path was inherited by sync_wallet_balance's
    // unqualified SQL. Use the public schema with the caller's JWT and RLS.
    const db = supabase.schema("public");
    const linkedTransactions = "wallet_id.eq." + walletId + ",destination_wallet_id.eq." + walletId;
    const { data: wallet, error: lookupError } = await db.from("wallets")
      .select("id,is_default").eq("user_id", user.id).eq("id", walletId).maybeSingle();
    if (lookupError) { logDbError("Wallet deletion lookup failed:", lookupError); return failure(); }
    if (!wallet) return { success: false, error: "That wallet no longer exists. Refresh your wallets." };
    const { data: replacement, error: replacementError } = await db.from("wallets")
      .select("id").eq("user_id", user.id).neq("id", walletId)
      .order("created_at").order("id").limit(1).maybeSingle();
    if (replacementError) { logDbError("Replacement wallet lookup failed:", replacementError); return failure(); }
    if (!replacement) return { success: false, error: "Keep at least one wallet. Create another before deleting this one." };

    // Promote before cleanup so a later failure cannot leave no default.
    // This existing RPC only changes flags and never fires the balance trigger.
    if (wallet.is_default) {
      const { error } = await supabase.rpc("set_default_wallet", { p_wallet_id: replacement.id });
      if (error) { logDbError("Replacement default failed:", error); return failure(); }
      cleanupStarted = true;
    }
    // Each request is atomic, but the sequence is not a database transaction.
    // Delete whole transfers in both directions, never null their destination.
    // The existing trigger reverses balances; FK SET NULL detaches history links.
    cleanupStarted = true;
    const { error: transactionsError } = await db.from("transactions").delete()
      .eq("user_id", user.id).or(linkedTransactions);
    if (transactionsError) { logDbError("Wallet transaction cleanup failed:", transactionsError); return failure(); }
    // RLS can silently filter a DELETE: verify cleanup before removing the wallet.
    const { count, error: remainingError } = await db.from("transactions")
      .select("id", { count: "exact", head: true }).eq("user_id", user.id).or(linkedTransactions);
    if (remainingError) { logDbError("Wallet cleanup verification failed:", remainingError); return failure(); }
    if (count !== 0) return failure();
    // Preserve commitment plans for reassignment to another billing wallet.
    const { error: rulesError } = await db.from("recurring_rules").update({ wallet_id: null })
      .eq("user_id", user.id).eq("wallet_id", walletId);
    if (rulesError) { logDbError("Wallet commitment cleanup failed:", rulesError); return failure(); }
    const { count: others, error: othersError } = await db.from("wallets")
      .select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("id", walletId);
    if (othersError) { logDbError("Remaining wallets lookup failed:", othersError); return failure(); }
    if (others === null || others < 1) return failure();
    const { data: deleted, error: deleteError } = await db.from("wallets").delete()
      .eq("user_id", user.id).eq("id", walletId).select("id").maybeSingle();
    if (deleteError) { logDbError("Wallet delete failed:", deleteError); return failure(); }
    if (!deleted) return failure();
    return { success: true };
  } catch (error) {
    console.error("Wallet deletion request failed:", error);
    return failure();
  } finally {
    // Refresh partial progress too. Retries remove existing rows, so the
    // database trigger cannot reverse the same transaction's balance twice.
    if (cleanupStarted) refreshDashboardPages();
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

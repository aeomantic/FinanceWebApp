"use server";

import { revalidatePath } from "next/cache";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { parseAmountMinor } from "@/lib/dashboard/validation";
import { commitmentInputSchema, commitmentMutationSchema } from "@/lib/commitments/validation";
import type { CommitmentInput, CommitmentResult } from "@/lib/commitments/types";

function refreshCommitments() {
  revalidatePath("/commitments");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

/** Saves a planned obligation. Paid counts are manual records, never wallet debits. */
export async function saveCommitment(input: CommitmentInput): Promise<CommitmentResult> {
  const parsed = commitmentInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the commitment details." };
  const value = parsed.data;
  const amountMinor = parseAmountMinor(value.amount);
  if (amountMinor === null) return { success: false, error: "Enter a valid amount." };
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) return { success: false, error: "Your session has expired. Please sign in again." };
    const { data: wallet, error: walletError } = await supabase.from("wallets").select("id,currency").eq("id", value.walletId).eq("user_id", user.id).single();
    if (walletError || !wallet) return { success: false, error: "Choose a wallet from your account." };
    if (value.categoryId) {
      const { data: category, error } = await supabase.from("categories").select("id").eq("id", value.categoryId).eq("user_id", user.id).eq("type", "expense").eq("is_archived", false).single();
      if (error || !category) return { success: false, error: "Choose an expense category from your account." };
    }
    const row = {
      user_id: user.id, name: value.name, amount_minor: amountMinor, currency: wallet.currency, wallet_id: value.walletId,
      category_id: value.categoryId ?? null, obligation_type: value.obligationType, frequency: value.frequency,
      interval_count: value.frequency === "custom_months" ? value.intervalCount : 1,
      billing_cycle: ["weekly", "monthly", "yearly"].includes(value.frequency) ? value.frequency : null,
      anchor_date: value.nextDueOn, next_due_on: value.nextDueOn,
      total_installments: value.obligationType === "bnpl" ? value.totalInstallments : null,
      paid_installments: value.obligationType === "bnpl" ? value.paidInstallments : 0,
      end_date: value.obligationType === "bnpl" ? value.endDate : null, icon: value.icon,
    };
    const result = value.id
      ? await supabase.from("recurring_rules").update(row).eq("id", value.id).eq("user_id", user.id).eq("updated_at", value.updatedAt!).select("id").maybeSingle()
      : await supabase.from("recurring_rules").insert(row).select("id").single();
    if (result.error) {
      console.error("Commitment save failed:", { code: result.error.code, message: result.error.message });
      return { success: false, error: "We couldn't save this commitment. Check the wallet, category, and schedule, then try again." };
    }
    if (!result.data) return { success: false, error: "This commitment changed in another window. Close this form and refresh before editing." };
    refreshCommitments();
    return { success: true };
  } catch { return { success: false, error: "We couldn't reach your account. Please try again." }; }
}

export async function changeCommitmentStatus(input: { id: string; updatedAt: string; isActive: boolean }): Promise<CommitmentResult> {
  const parsed = commitmentMutationSchema.safeParse(input);
  if (!parsed.success || typeof input.isActive !== "boolean") return { success: false, error: "Choose a valid commitment." };
  return mutateCommitment(parsed.data, input.isActive);
}

export async function deleteCommitment(input: { id: string; updatedAt: string }): Promise<CommitmentResult> {
  const parsed = commitmentMutationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Choose a valid commitment." };
  return mutateCommitment(parsed.data, null);
}

async function mutateCommitment(input: { id: string; updatedAt: string }, active: boolean | null): Promise<CommitmentResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) return { success: false, error: "Your session has expired. Please sign in again." };
    const query = active === null ? supabase.from("recurring_rules").delete() : supabase.from("recurring_rules").update({ is_active: active });
    const { data, error } = await query.eq("id", input.id).eq("user_id", user.id).eq("updated_at", input.updatedAt).select("id").maybeSingle();
    if (error) {
      console.error("Commitment update failed:", { code: error.code, message: error.message });
      return { success: false, error: "We couldn't update this commitment. Please try again." };
    }
    if (!data) return { success: false, error: "This commitment changed in another window. Refresh and try again." };
    refreshCommitments();
    return { success: true };
  } catch { return { success: false, error: "We couldn't reach your account. Please try again." }; }
}

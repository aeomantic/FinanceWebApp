"use server";

import { revalidatePath } from "next/cache";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { parseAmountMinor, transactionInputSchema } from "@/lib/dashboard/validation";
import type { RecordTransactionInput, RecordTransactionResult } from "@/lib/dashboard/types";

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

    const { error: profileError } = await supabase.from("profiles").upsert(
      { id: user.id, email: user.email!.trim().toLowerCase() },
      { onConflict: "id" },
    );
    if (profileError) return { success: false, error: "We couldn't prepare your account. Please try again." };

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      merchant: parsed.data.title,
      amount_minor: amountMinor,
      currency: parsed.data.currency,
      occurred_on: parsed.data.date,
      type: parsed.data.type,
    });
    if (error) return { success: false, error: "We couldn't save this transaction. Please try again." };
  } catch {
    return { success: false, error: "We couldn't reach your account. Check your connection and try again." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

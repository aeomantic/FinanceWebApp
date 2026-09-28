"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { investmentSchema, type InvestmentInput } from "@/lib/investments/validation";
import { uuidSchema } from "@/lib/dashboard/validation";

export async function saveInvestment(input: InvestmentInput): Promise<{ success: boolean; error?: string }> {
  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your holding details." };
  try {
    const db = await createClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) return { success: false, error: "Please sign in again." };
    const { id, ...values } = parsed.data;
    if (values.wallet_id) {
      const { data, error } = await db.from("wallets").select("id").eq("id", values.wallet_id).eq("user_id", user.id).maybeSingle();
      if (error || !data) return { success: false, error: "Choose a wallet from your account." };
    }
    const row = { ...values, wallet_id: values.wallet_id || null, notes: values.notes || null, user_id: user.id };
    const query = id ? db.from("investments").update(row).eq("id", id).eq("user_id", user.id) : db.from("investments").insert(row);
    const { data, error } = await query.select("id").maybeSingle();
    if (error || !data) return { success: false, error: "Couldn't save this holding. Refresh and try again." };
    revalidatePath("/investments");
    return { success: true };
  } catch { return { success: false, error: "Couldn't reach your account. Please try again." }; }
}

export async function deleteInvestment(id: string): Promise<{ success: boolean; error?: string }> {
  if (!uuidSchema.safeParse(id).success) return { success: false, error: "Choose a valid holding." };
  try {
    const db = await createClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) return { success: false, error: "Please sign in again." };
    const { error } = await db.from("investments").delete().eq("id", id).eq("user_id", user.id);
    if (error) return { success: false, error: "Couldn't delete this holding. Please try again." };
    revalidatePath("/investments");
    return { success: true };
  } catch { return { success: false, error: "Couldn't reach your account. Please try again." }; }
}

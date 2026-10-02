"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { parseAmountMinor } from "@/lib/dashboard/validation";
import { initialBillDueDate } from "@/lib/monthly-expense";

const version = z.object({ id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }) });
const inputSchema = z.object({
  id: z.string().uuid().optional(), updated_at: z.string().optional(),
  biller_name: z.string().trim().min(1).max(120), amount: z.string(),
  due_day: z.coerce.number().int().min(1).max(31), frequency: z.enum(["monthly", "quarterly", "yearly"]),
  wallet_id: z.string().uuid(), category_id: z.union([z.string().uuid(), z.literal("")]),
  notes: z.string().max(2000), auto_pay: z.boolean(),
});
export type BillInput = z.input<typeof inputSchema>;
type Result = { success: true } | { success: false; error: string };
function refresh() { for (const path of ["/dashboard", "/transactions", "/wallets", "/settings"]) revalidatePath(path); }
async function account() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) throw new Error("Session expired");
  return { db, user };
}
export async function saveBill(input: BillInput): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Check the bill details and select a wallet." };
  const b = parsed.data;
  const amount = parseAmountMinor(b.amount);
  if (amount === null || amount <= 0) return { success: false, error: "Enter a positive amount with up to two decimal places." };
  if (b.id && !version.safeParse(b).success) return { success: false, error: "Refresh before editing this bill." };
  try {
    const { db, user } = await account();
    const { data: wallet } = await db.from("wallets").select("currency").eq("id", b.wallet_id).eq("user_id", user.id).single();
    if (!wallet) return { success: false, error: "Choose a wallet from your account." };
    const row = { user_id: user.id, biller_name: b.biller_name, amount: amount / 100, due_day: b.due_day, frequency: b.frequency, wallet_id: b.wallet_id, currency: wallet.currency, category_id: b.category_id || null, notes: b.notes || null, auto_pay: b.auto_pay };
    let next_due_date: string | undefined;
    if (b.id) {
      const { data: old } = await db.from("bills").select("due_day,next_due_date").eq("id", b.id).eq("user_id", user.id).eq("updated_at", b.updated_at!).single();
      if (!old) return { success: false, error: "This bill changed. Close the form and refresh." };
      // Preserve an unpaid occurrence when editing its amount or frequency.
      if (old.due_day !== b.due_day) next_due_date = initialBillDueDate(b.due_day, `${old.next_due_date.slice(0, 7)}-01`);
    } else next_due_date = initialBillDueDate(b.due_day, new Date().toISOString().slice(0, 10));
    const values = { ...row, ...(next_due_date ? { next_due_date } : {}) };
    const result = b.id
      ? await db.from("bills").update(values).eq("id", b.id).eq("user_id", user.id).eq("updated_at", b.updated_at!).select("id").maybeSingle()
      : await db.from("bills").insert(values).select("id").single();
    if (result.error || !result.data) return { success: false, error: "Could not save this bill. Check its category and refresh before retrying." };
    refresh(); return { success: true };
  } catch { return { success: false, error: "Could not reach your account. Please sign in and try again." }; }
}
export async function mutateBill(input: { id: string; updated_at: string }, action: "pay" | "delete"): Promise<Result> {
  if (!version.safeParse(input).success || !["pay", "delete"].includes(action)) return { success: false, error: "Choose a valid bill." };
  try {
    const { db, user } = await account();
    const result = action === "pay"
      ? await db.rpc("mark_bill_paid", { p_id: input.id, p_updated_at: input.updated_at })
      : await db.from("bills").delete().eq("id", input.id).eq("user_id", user.id).eq("updated_at", input.updated_at).select("id").maybeSingle();
    if (result.error || !result.data) return { success: false, error: "This bill may have changed or been paid already. Refresh and check its assigned wallet before retrying." };
    refresh(); return { success: true };
  } catch { return { success: false, error: "Could not confirm this change. Refresh before retrying." }; }
}

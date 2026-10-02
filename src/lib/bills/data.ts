import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/auth/current-user";
import type { Bill } from "./types";

export async function getBills(): Promise<{ bills: Bill[]; error: string | null }> {
  try {
    const [db, user] = await Promise.all([createClient(), getAuthedUser()]);
    const { data, error, count } = await db.from("bills").select("*", { count: "exact" }).eq("user_id", user.id).order("next_due_date").order("id").limit(1000);
    if (error || count === null || count !== data?.length) return { bills: [], error: "Bills could not be loaded. Check that the bills migration has been applied, then refresh." };
    const bills = data.map(row => ({ ...row, amount: Number(row.amount) })) as Bill[];
    if (bills.some(b => !Number.isFinite(b.amount) || b.amount <= 0 || !Number.isSafeInteger(Math.round(b.amount * 100)))) return { bills: [], error: "Some bills contain unsupported amounts." };
    return { bills, error: null };
  } catch { return { bills: [], error: "Bills could not be loaded. Please refresh." }; }
}

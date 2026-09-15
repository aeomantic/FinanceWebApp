import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { isValidDate, SUPPORTED_CURRENCIES } from "@/lib/dashboard/summary";
import type { CommitmentsData } from "./types";

const walletSchema = z.object({
  id: z.string().uuid(), name: z.string(), currency: z.enum(SUPPORTED_CURRENCIES),
  balance_minor: z.union([z.number(), z.string().regex(/^-?\d+$/).transform(Number)]).refine((value) => Number.isSafeInteger(value)),
  color: z.string().nullable(), is_default: z.boolean(),
});
const categorySchema = z.object({
  id: z.string().uuid(), name: z.string(), type: z.enum(["expense", "income"]),
  icon: z.string().nullable(), color: z.string().nullable(),
});
const rowSchema = z.object({
  id: z.string().uuid(), name: z.string(),
  amount_minor: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).refine((n) => Number.isSafeInteger(n) && n > 0),
  currency: z.enum(SUPPORTED_CURRENCIES), wallet_id: z.string().uuid().nullable(), category_id: z.string().uuid().nullable(),
  obligation_type: z.enum(["subscription", "bnpl"]),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly", "custom_months"]),
  interval_count: z.number().int().min(1).max(120),
  anchor_date: z.string().refine(isValidDate), next_due_on: z.string().refine(isValidDate),
  total_installments: z.number().int().min(1).max(600).nullable(), paid_installments: z.number().int().min(0).max(600),
  end_date: z.string().refine(isValidDate).nullable(), icon: z.string(), is_active: z.boolean(), updated_at: z.string(),
}).refine((r) => r.obligation_type !== "bnpl" || (r.total_installments !== null && r.paid_installments <= r.total_installments && r.end_date !== null && Number.isSafeInteger(r.amount_minor * r.total_installments)));

export async function getCommitmentsData(): Promise<CommitmentsData> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/login?error=unauthorized");
  const today = new Date().toISOString().slice(0, 10);
  const metadataName: unknown = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const name = typeof metadataName === "string" && metadataName.trim() ? metadataName.trim().slice(0, 80) : (user.email?.split("@")[0] ?? "there");
  const base: CommitmentsData = { commitments: [], wallets: [], categories: [], today, name, error: null };
  try {
    const [commitmentsRes, walletsRes, categoriesRes] = await Promise.all([
      supabase.from("recurring_rules")
        .select("id,name,amount_minor,currency,wallet_id,category_id,obligation_type,frequency,interval_count,anchor_date,next_due_on,total_installments,paid_installments,end_date,icon,is_active,updated_at", { count: "exact" })
        .eq("user_id", user.id).order("next_due_on").order("id").limit(1000),
      supabase.from("wallets").select("id,name,currency,balance_minor,color,is_default").eq("user_id", user.id)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true }),
      supabase.from("categories").select("id,name,type,icon,color").eq("user_id", user.id).eq("type", "expense").eq("is_archived", false).order("name"),
    ]);
    if (commitmentsRes.error) {
      console.error("Commitments load failed:", { code: commitmentsRes.error.code, message: commitmentsRes.error.message });
      return { ...base, error: "We couldn't load your commitments. Please refresh or check that the commitments migration has been applied." };
    }
    if (walletsRes.error || categoriesRes.error) return { ...base, error: "We couldn't load your wallets or categories. Please refresh and try again." };
    if (commitmentsRes.count === null || commitmentsRes.count > 1000) return { ...base, error: "Your commitments exceed the supported list size. Totals are unavailable." };

    const parsedWallets = z.array(walletSchema).safeParse(walletsRes.data);
    if (!parsedWallets.success) return { ...base, error: "Some wallets contain unsupported data. Please refresh and try again." };
    const parsedCategories = z.array(categorySchema).safeParse(categoriesRes.data);
    if (!parsedCategories.success) return { ...base, error: "Some categories contain unsupported data. Please refresh and try again." };
    const parsed = z.array(rowSchema).safeParse(commitmentsRes.data);
    if (!parsed.success) return { ...base, error: "Some commitments contain unsupported amounts or schedules. Check their details before continuing." };

    return {
      ...base,
      wallets: parsedWallets.data.map((row) => ({ id: row.id, name: row.name, currency: row.currency, balanceMinor: row.balance_minor, color: row.color, isDefault: row.is_default })),
      categories: parsedCategories.data,
      commitments: parsed.data.map((r) => ({ id: r.id, name: r.name, amountMinor: r.amount_minor, currency: r.currency,
        walletId: r.wallet_id, categoryId: r.category_id, obligationType: r.obligation_type, frequency: r.frequency,
        intervalCount: r.interval_count, anchorDate: r.anchor_date, nextDueOn: r.next_due_on, totalInstallments: r.total_installments,
        paidInstallments: r.paid_installments, endDate: r.end_date, icon: r.icon, isActive: r.is_active, updatedAt: r.updated_at })),
    };
  } catch { return { ...base, error: "We couldn't reach your account. Please try again." }; }
}

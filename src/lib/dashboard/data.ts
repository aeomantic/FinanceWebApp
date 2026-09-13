import "server-only";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { getPeriodStart, isValidDate, summarizeTransactions, SUPPORTED_CURRENCIES } from "./summary";
import type { DashboardData, Transaction } from "./types";

const PAGE_SIZE = 1000;
const MAX_TRANSACTIONS = 10000;
const transactionRowSchema = z.object({
  id: z.string().uuid(),
  occurred_on: z.string().refine(isValidDate),
  amount_minor: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
    .refine((value) => Number.isSafeInteger(value) && value >= 0),
  currency: z.enum(SUPPORTED_CURRENCIES),
  type: z.enum(["income", "expense"]),
  merchant: z.string().nullable(),
});

/** This read uses the caller's cookie session and remains subject to Supabase RLS. */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/login?error=unauthorized");

  const today = new Date().toISOString().slice(0, 10);
  const periodStart = getPeriodStart(today);
  const metadataName: unknown = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const name = typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim().slice(0, 80)
    : (user.email?.split("@")[0] ?? "there");
  const base: DashboardData = { transactions: [], today, periodStart, name, email: user.email ?? "", error: null };

  try {
    const transactions: Transaction[] = [];

    for (let offset = 0; offset < MAX_TRANSACTIONS;) {
      const { data, error, count } = await supabase
        .from("transactions")
        .select("id,occurred_on,amount_minor,currency,type,merchant", { count: "exact" })
        .eq("user_id", user.id)
        .gte("occurred_on", periodStart)
        .lte("occurred_on", today)
        .order("occurred_on", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, Math.min(offset + PAGE_SIZE, MAX_TRANSACTIONS) - 1);

      if (error) return { ...base, error: "We couldn't load your transactions. Please try refreshing the page." };
      if (count === null) return { ...base, error: "We couldn't verify the full transaction history. Please refresh the page." };
      if (count > MAX_TRANSACTIONS) {
        return { ...base, error: "This period contains more than 10,000 transactions. Dashboard totals are unavailable." };
      }

      const result = z.array(transactionRowSchema).safeParse(data);
      if (!result.success) {
        return { ...base, error: "Some transactions contain unsupported amounts or currencies. Dashboard totals are unavailable." };
      }

      for (const row of result.data) {
        transactions.push({
          id: row.id,
          date: row.occurred_on,
          title: row.merchant?.trim() || (row.type === "income" ? "Payment received" : "Payment"),
          amountMinor: row.amount_minor,
          currency: row.currency,
          type: row.type,
        });
      }

      offset += result.data.length;
      if (offset >= count) break;
      if (result.data.length === 0) return { ...base, error: "Your transaction history changed while loading. Please refresh the page." };
    }

    // Reject unsafe aggregate totals before sending money values to the UI.
    for (const currency of new Set(transactions.map((transaction) => transaction.currency))) {
      summarizeTransactions(transactions, currency, today);
    }

    return { ...base, transactions };
  } catch {
    return { ...base, error: "We couldn't safely load your dashboard. Please try again." };
  }
}

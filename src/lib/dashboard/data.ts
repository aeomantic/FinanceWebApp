import "server-only";

import { z } from "zod";
import { getAuthedUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getPeriodStart, isValidDate, summarizeTransactions, SUPPORTED_CURRENCIES } from "./summary";
import type { Category, DashboardData, Transaction, Wallet } from "./types";

const PAGE_SIZE = 1000;
const MAX_TRANSACTIONS = 10000;

// One definition for both the first-page and pagination-loop reads, so the two
// can't drift apart. `created_at` is the row's recorded timestamp; `occurred_on`
// is the date-only day the owner assigned to the money movement.
const TRANSACTION_COLUMNS = "id,occurred_on,created_at,amount_minor,currency,type,note,wallet_id,destination_wallet_id,category:categories(name,icon)";

const walletRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  balance_minor: z.union([z.number(), z.string().regex(/^-?\d+$/).transform(Number)])
    .refine((value) => Number.isSafeInteger(value)),
  color: z.string().nullable(),
  is_default: z.boolean(),
});

const categoryRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(["expense", "income"]),
  icon: z.string().nullable(),
  color: z.string().nullable(),
});

const transactionRowSchema = z.object({
  id: z.string().uuid(),
  occurred_on: z.string().refine(isValidDate),
  created_at: z.string(),
  amount_minor: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
    .refine((value) => Number.isSafeInteger(value) && value >= 0),
  currency: z.enum(SUPPORTED_CURRENCIES),
  type: z.enum(["income", "expense", "transfer"]),
  note: z.string().nullable(),
  wallet_id: z.string().uuid(),
  destination_wallet_id: z.string().uuid().nullable(),
  category: z.object({ name: z.string(), icon: z.string().nullable() }).nullable(),
});

function walletTitle(wallets: Map<string, Wallet>, transaction: z.infer<typeof transactionRowSchema>): string {
  if (transaction.type === "transfer") {
    const destination = transaction.destination_wallet_id ? wallets.get(transaction.destination_wallet_id) : undefined;
    return destination ? `Transfer to ${destination.name}` : "Transfer";
  }
  return transaction.category?.name ?? (transaction.type === "income" ? "Income" : "Expense");
}

/** This read uses the caller's cookie session and remains subject to Supabase RLS. */
export async function getDashboardData(): Promise<DashboardData> {
  const [supabase, user] = await Promise.all([createClient(), getAuthedUser()]);

  const today = new Date().toISOString().slice(0, 10);
  const periodStart = getPeriodStart(today);
  const name = user.name && user.name.trim()
    ? user.name.trim().slice(0, 80)
    : (user.email.split("@")[0] || "there");
  const base: DashboardData = { wallets: [], categories: [], transactions: [], today, periodStart, name, email: user.email, error: null };

  try {
    // Wallets and categories are needed to interpret transaction rows
    // (wallet names for transfer titles, category names/icons), but the
    // transactions query itself doesn't depend on either resolving first -
    // firing all three at once removes a full network round trip from the
    // critical path instead of waiting for wallets+categories, then asking
    // for the first page of transactions.
    const firstTransactionsPage = supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS, { count: "exact" })
      .eq("user_id", user.id)
      .gte("occurred_on", periodStart)
      .lte("occurred_on", today)
      .order("occurred_on", { ascending: false })
      .order("id", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    const [walletsRes, categoriesRes, firstPageRes, profileRes] = await Promise.all([
      supabase.from("wallets").select("id,name,currency,balance_minor,color,is_default").eq("user_id", user.id)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true }),
      supabase.from("categories").select("id,name,type,icon,color").eq("user_id", user.id).eq("is_archived", false).order("created_at", { ascending: true }),
      firstTransactionsPage,
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    ]);

    if (walletsRes.error) return { ...base, error: "We couldn't load your wallets. Please try refreshing the page." };
    if (categoriesRes.error) return { ...base, error: "We couldn't load your categories. Please try refreshing the page." };

    // User-managed categories stay deleted; page reads never recreate them.
    const categoryRows = categoriesRes.data;
    const displayName = profileRes.data?.display_name;
    if (!profileRes.error && typeof displayName === "string" && displayName.trim()) {
      base.name = displayName.trim().slice(0, 80);
    }

    const parsedWallets = z.array(walletRowSchema).safeParse(walletsRes.data);
    if (!parsedWallets.success) return { ...base, error: "Some wallets contain unsupported data. Please try refreshing the page." };
    const parsedCategories = z.array(categoryRowSchema).safeParse(categoryRows);
    if (!parsedCategories.success) return { ...base, error: "Some categories contain unsupported data. Please try refreshing the page." };

    const wallets: Wallet[] = parsedWallets.data.map((row) => ({
      id: row.id, name: row.name, currency: row.currency, balanceMinor: row.balance_minor, color: row.color, isDefault: row.is_default,
    }));
    const categories: Category[] = parsedCategories.data.map((row) => ({
      id: row.id, name: row.name, type: row.type, icon: row.icon, color: row.color,
    }));
    const walletsById = new Map(wallets.map((wallet) => [wallet.id, wallet]));

    const transactions: Transaction[] = [];

    for (let offset = 0; offset < MAX_TRANSACTIONS;) {
      // The first page was already fetched concurrently with wallets/categories above.
      const { data, error, count } = offset === 0 ? firstPageRes : await supabase
        .from("transactions")
        .select(TRANSACTION_COLUMNS, { count: "exact" })
        .eq("user_id", user.id)
        .gte("occurred_on", periodStart)
        .lte("occurred_on", today)
        .order("occurred_on", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, Math.min(offset + PAGE_SIZE, MAX_TRANSACTIONS) - 1);

      if (error) return { ...base, wallets, categories, error: "We couldn't load your transactions. Please try refreshing the page." };
      if (count === null) return { ...base, wallets, categories, error: "We couldn't verify the full transaction history. Please refresh the page." };
      if (count > MAX_TRANSACTIONS) {
        return { ...base, wallets, categories, error: "This period contains more than 10,000 transactions. Dashboard totals are unavailable." };
      }

      const result = z.array(transactionRowSchema).safeParse(data);
      if (!result.success) {
        return { ...base, wallets, categories, error: "Some transactions contain unsupported amounts or currencies. Dashboard totals are unavailable." };
      }

      for (const row of result.data) {
        transactions.push({
          id: row.id,
          date: row.occurred_on,
          title: walletTitle(walletsById, row),
          amountMinor: row.amount_minor,
          currency: row.currency,
          type: row.type,
          category: row.category?.name,
          categoryIcon: row.category?.icon ?? undefined,
          walletId: row.wallet_id,
          destinationWalletId: row.destination_wallet_id ?? undefined,
          note: row.note ?? undefined,
          recordedAt: row.created_at,
        });
      }

      offset += result.data.length;
      if (offset >= count) break;
      if (result.data.length === 0) return { ...base, wallets, categories, error: "Your transaction history changed while loading. Please refresh the page." };
    }

    // Reject unsafe aggregate totals before sending money values to the UI.
    for (const currency of new Set(transactions.map((transaction) => transaction.currency))) {
      summarizeTransactions(transactions, currency, today);
    }

    return { ...base, wallets, categories, transactions };
  } catch {
    return { ...base, error: "We couldn't safely load your dashboard. Please try again." };
  }
}

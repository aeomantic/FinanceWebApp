import "server-only";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isValidDate, SUPPORTED_CURRENCIES } from "@/lib/dashboard/summary";
import type { GoalsData, GoalsSummary } from "./types";

const minorAmount = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).refine((value) => Number.isSafeInteger(value) && value >= 0);

const goalRowSchema = z.object({
  id: z.string().uuid(), title: z.string(),
  target_minor: minorAmount, saved_minor: minorAmount,
  currency: z.enum(SUPPORTED_CURRENCIES),
  deadline: z.string().refine(isValidDate).nullable(),
  icon: z.string().nullable(), updated_at: z.string(),
});

const wishRowSchema = z.object({
  id: z.string().uuid(), name: z.string(),
  target_price_minor: minorAmount.nullable(),
  url: z.string().nullable(), notes: z.string().nullable(),
  icon: z.string().nullable(), converted_goal_id: z.string().uuid().nullable(),
});

/** A lean read for the dashboard's Goals summary and Wishlist preview cards.
 * Fails soft (empty lists, no error) like getUpcomingCommitments: a pending
 * goals migration or a transient error should never block the dashboard, it
 * should just render the cards empty. */
export async function getGoalsSummary(): Promise<GoalsSummary> {
  const empty: GoalsSummary = { goals: [], wishes: [], primaryCurrency: "SGD" };
  const [supabase, user] = await Promise.all([createClient(), getAuthedUser()]);
  try {
    const [goalsRes, wishesRes, walletsRes] = await Promise.all([
      supabase.from("goals").select("id,title,target_minor,saved_minor,currency,deadline,icon,updated_at")
        .eq("user_id", user.id).order("created_at", { ascending: true }).order("id").limit(4),
      supabase.from("wishlist_items").select("id,name,target_price_minor,url,notes,icon,converted_goal_id")
        .eq("user_id", user.id).eq("status", "active").is("converted_goal_id", null).order("created_at", { ascending: false }).order("id").limit(3),
      supabase.from("wallets").select("currency,is_default").eq("user_id", user.id)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true }).limit(1),
    ]);
    if (goalsRes.error && wishesRes.error) return empty;
    const parsedGoals = z.array(goalRowSchema).safeParse(goalsRes.data ?? []);
    const parsedWishes = z.array(wishRowSchema).safeParse(wishesRes.data ?? []);
    const defaultCurrency = walletsRes.error ? undefined : walletsRes.data?.[0]?.currency;
    return {
      primaryCurrency: defaultCurrency && (SUPPORTED_CURRENCIES as readonly string[]).includes(defaultCurrency) ? defaultCurrency : empty.primaryCurrency,
      goals: parsedGoals.success ? parsedGoals.data.map((row) => ({
        id: row.id, title: row.title, targetMinor: row.target_minor, savedMinor: row.saved_minor,
        currency: row.currency, deadline: row.deadline, icon: row.icon, updatedAt: row.updated_at,
      })) : [],
      wishes: parsedWishes.success ? parsedWishes.data.map((row) => ({
        id: row.id, name: row.name, priceMinor: row.target_price_minor,
        url: row.url, note: row.notes, icon: row.icon, convertedGoalId: row.converted_goal_id,
      })) : [],
    };
  } catch { return empty; }
}

export async function getGoalsData(): Promise<GoalsData> {
  const [supabase, user] = await Promise.all([createClient(), getAuthedUser()]);
  const today = new Date().toISOString().slice(0, 10);
  const name = user.name && user.name.trim() ? user.name.trim().slice(0, 80) : (user.email.split("@")[0] || "there");
  const base: GoalsData = { goals: [], wishes: [], primaryCurrency: "SGD", today, name, error: null };
  try {
    const [goalsRes, wishesRes, walletsRes] = await Promise.all([
      supabase.from("goals").select("id,title,target_minor,saved_minor,currency,deadline,icon,updated_at")
        .eq("user_id", user.id).order("created_at", { ascending: true }).order("id").limit(200),
      // Converted wishes stay in the list (with a link to their goal) until archived,
      // so only the status filter narrows this read.
      supabase.from("wishlist_items").select("id,name,target_price_minor,url,notes,icon,converted_goal_id")
        .eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: true }).order("id").limit(200),
      supabase.from("wallets").select("currency,is_default").eq("user_id", user.id)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true }).limit(1),
    ]);
    if (goalsRes.error || wishesRes.error) {
      const failure = goalsRes.error ?? wishesRes.error;
      console.error("Goals load failed:", { code: failure?.code, message: failure?.message });
      return { ...base, error: "We couldn't load your goals. Please refresh or check that the goals migration has been applied." };
    }
    const parsedGoals = z.array(goalRowSchema).safeParse(goalsRes.data);
    if (!parsedGoals.success) return { ...base, error: "Some goals contain unsupported data. Please refresh and try again." };
    const parsedWishes = z.array(wishRowSchema).safeParse(wishesRes.data);
    if (!parsedWishes.success) return { ...base, error: "Some wishlist items contain unsupported data. Please refresh and try again." };
    const defaultCurrency = walletsRes.error ? undefined : walletsRes.data?.[0]?.currency;
    return {
      ...base,
      primaryCurrency: defaultCurrency && (SUPPORTED_CURRENCIES as readonly string[]).includes(defaultCurrency) ? defaultCurrency : base.primaryCurrency,
      goals: parsedGoals.data.map((row) => ({
        id: row.id, title: row.title, targetMinor: row.target_minor, savedMinor: row.saved_minor,
        currency: row.currency, deadline: row.deadline, icon: row.icon, updatedAt: row.updated_at,
      })),
      wishes: parsedWishes.data.map((row) => ({
        id: row.id, name: row.name, priceMinor: row.target_price_minor,
        url: row.url, note: row.notes, icon: row.icon, convertedGoalId: row.converted_goal_id,
      })),
    };
  } catch { return { ...base, error: "We couldn't reach your account. Please try again." }; }
}

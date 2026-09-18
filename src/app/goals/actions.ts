"use server";

import { revalidatePath } from "next/cache";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { parseAmountMinor } from "@/lib/dashboard/validation";
import {
  convertWishInputSchema, createGoalInputSchema, createWishInputSchema,
  depositToGoalInputSchema, goalMutationSchema, wishMutationSchema,
} from "@/lib/goals/validation";
import type { ConvertWishInput, CreateGoalInput, CreateWishInput, DepositToGoalInput, GoalsResult } from "@/lib/goals/types";

function refreshGoals() {
  revalidatePath("/goals");
}

async function authedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !isAllowedEmail(user.email)) return null;
  return { supabase, user };
}

const EXPIRED = { success: false, error: "Your session has expired. Please sign in again." } as const;
const UNREACHABLE = { success: false, error: "We couldn't reach your account. Please try again." } as const;

/** Goals are a savings tally, never a wallet write: creating or funding one
 * touches only public.goals, so real money movements stay ledger transactions. */
export async function createGoal(input: CreateGoalInput): Promise<GoalsResult> {
  const parsed = createGoalInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the goal details." };
  const targetMinor = parseAmountMinor(parsed.data.target);
  if (targetMinor === null) return { success: false, error: "Enter a valid target amount." };
  const savedMinor = parsed.data.saved ? parseAmountMinor(parsed.data.saved) : 0;
  if (savedMinor === null) return { success: false, error: "Enter a valid starting amount." };
  try {
    const authed = await authedClient();
    if (!authed) return EXPIRED;
    const { error } = await authed.supabase.from("goals").insert({
      user_id: authed.user.id, title: parsed.data.title, target_minor: targetMinor, saved_minor: savedMinor,
      currency: parsed.data.currency, deadline: parsed.data.deadline ?? null, icon: parsed.data.icon ?? null,
    });
    if (error) {
      console.error("Goal create failed:", { code: error.code, message: error.message });
      return { success: false, error: "We couldn't save this goal. Please try again." };
    }
    refreshGoals();
    return { success: true };
  } catch { return UNREACHABLE; }
}

export async function depositToGoal(input: DepositToGoalInput): Promise<GoalsResult> {
  const parsed = depositToGoalInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the amount." };
  const amountMinor = parseAmountMinor(parsed.data.amount);
  if (amountMinor === null) return { success: false, error: "Enter a valid amount." };
  try {
    const authed = await authedClient();
    if (!authed) return EXPIRED;
    const { supabase, user } = authed;
    const { data: goal, error: goalError } = await supabase.from("goals").select("saved_minor").eq("id", parsed.data.id).eq("user_id", user.id).maybeSingle();
    if (goalError || !goal) return { success: false, error: "That goal could not be found. Refresh and try again." };
    const currentSaved = typeof goal.saved_minor === "string" ? Number(goal.saved_minor) : goal.saved_minor;
    const nextSaved = currentSaved + amountMinor;
    if (!Number.isSafeInteger(nextSaved)) return { success: false, error: "That amount would push the goal past the supported range." };
    // The updated_at filter is the same optimistic-concurrency guard commitments
    // use: a deposit computed against a stale read fails closed instead of
    // silently overwriting a concurrent one.
    const { data, error } = await supabase.from("goals")
      .update({ saved_minor: nextSaved, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id).eq("user_id", user.id).eq("updated_at", parsed.data.updatedAt)
      .select("id").maybeSingle();
    if (error) {
      console.error("Goal deposit failed:", { code: error.code, message: error.message });
      return { success: false, error: "We couldn't record this deposit. Please try again." };
    }
    if (!data) return { success: false, error: "This goal changed in another window. Refresh and try again." };
    refreshGoals();
    return { success: true };
  } catch { return UNREACHABLE; }
}

/** Deleting a goal also frees any wish that converted into it (the FK sets
 * converted_goal_id back to null), so the wish becomes convertible again. */
export async function deleteGoal(input: { id: string; updatedAt: string }): Promise<GoalsResult> {
  const parsed = goalMutationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Choose a valid goal." };
  try {
    const authed = await authedClient();
    if (!authed) return EXPIRED;
    const { data, error } = await authed.supabase.from("goals").delete()
      .eq("id", parsed.data.id).eq("user_id", authed.user.id).eq("updated_at", parsed.data.updatedAt)
      .select("id").maybeSingle();
    if (error) {
      console.error("Goal delete failed:", { code: error.code, message: error.message });
      return { success: false, error: "We couldn't delete this goal. Please try again." };
    }
    if (!data) return { success: false, error: "This goal changed in another window. Refresh and try again." };
    refreshGoals();
    return { success: true };
  } catch { return UNREACHABLE; }
}

export async function createWishlistItem(input: CreateWishInput): Promise<GoalsResult> {
  const parsed = createWishInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the wish details." };
  const priceMinor = parsed.data.price ? parseAmountMinor(parsed.data.price) : null;
  if (parsed.data.price && priceMinor === null) return { success: false, error: "Enter a valid price." };
  try {
    const authed = await authedClient();
    if (!authed) return EXPIRED;
    const { error } = await authed.supabase.from("wishlist_items").insert({
      user_id: authed.user.id, name: parsed.data.name, target_price_minor: priceMinor,
      url: parsed.data.url ?? null, notes: parsed.data.note ?? null, icon: parsed.data.icon ?? null,
    });
    if (error) {
      console.error("Wish create failed:", { code: error.code, message: error.message });
      return { success: false, error: "We couldn't save this wish. Please try again." };
    }
    refreshGoals();
    return { success: true };
  } catch { return UNREACHABLE; }
}

export async function deleteWishlistItem(input: { id: string }): Promise<GoalsResult> {
  const parsed = wishMutationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Choose a valid wish." };
  try {
    const authed = await authedClient();
    if (!authed) return EXPIRED;
    const { data, error } = await authed.supabase.from("wishlist_items").delete()
      .eq("id", parsed.data.id).eq("user_id", authed.user.id).select("id").maybeSingle();
    if (error) {
      console.error("Wish delete failed:", { code: error.code, message: error.message });
      return { success: false, error: "We couldn't delete this wish. Please try again." };
    }
    if (!data) return { success: false, error: "That wish could not be found. Refresh and try again." };
    refreshGoals();
    return { success: true };
  } catch { return UNREACHABLE; }
}

export async function convertWishToGoal(input: ConvertWishInput): Promise<GoalsResult> {
  const parsed = convertWishInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the goal details." };
  const targetMinor = parseAmountMinor(parsed.data.target);
  if (targetMinor === null) return { success: false, error: "Enter a valid target amount." };
  try {
    const authed = await authedClient();
    if (!authed) return EXPIRED;
    const { supabase, user } = authed;
    const { data: wish, error: wishError } = await supabase.from("wishlist_items")
      .select("id,name,icon,converted_goal_id").eq("id", parsed.data.id).eq("user_id", user.id).maybeSingle();
    if (wishError || !wish) return { success: false, error: "That wish could not be found. Refresh and try again." };
    if (wish.converted_goal_id) return { success: false, error: "This wish is already in your goals." };
    // Legacy wishes predate the 80-character goal title limit, so trim to fit.
    const title = (typeof wish.name === "string" ? wish.name : "").trim().slice(0, 80).trim();
    if (!title) return { success: false, error: "Give this wish a name before converting it." };
    const { data: goal, error: goalError } = await supabase.from("goals").insert({
      user_id: user.id, title, target_minor: targetMinor, saved_minor: 0,
      currency: parsed.data.currency, deadline: parsed.data.deadline ?? null, icon: wish.icon ?? null,
    }).select("id").single();
    if (goalError || !goal) {
      console.error("Wish conversion failed:", { code: goalError?.code, message: goalError?.message });
      return { success: false, error: "We couldn't create the goal. Please try again." };
    }
    // The is-null filter makes a double submit converge on one goal: whichever
    // request links first wins, and the loser removes its own orphan below.
    const { data: linked, error: linkError } = await supabase.from("wishlist_items")
      .update({ converted_goal_id: goal.id })
      .eq("id", wish.id).eq("user_id", user.id).is("converted_goal_id", null)
      .select("id").maybeSingle();
    if (linkError || !linked) {
      await supabase.from("goals").delete().eq("id", goal.id).eq("user_id", user.id);
      return { success: false, error: "This wish changed in another window. Refresh and try again." };
    }
    refreshGoals();
    return { success: true };
  } catch { return UNREACHABLE; }
}

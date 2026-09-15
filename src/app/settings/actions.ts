"use server";

import { revalidatePath } from "next/cache";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { categoryUpdateSchema, profileInputSchema, themePreferenceSchema } from "@/lib/settings/validation";
import type { CategoryUpdateInput, ProfileInput, SettingsResult, ThemePreference } from "@/lib/settings/types";
import { z } from "zod";

function refreshPages() {
  for (const path of ["/settings", "/dashboard", "/transactions", "/wallets", "/commitments"]) revalidatePath(path);
}
async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user || !isAllowedEmail(user.email) ? null : { supabase, user };
}
const SESSION_ERROR = "Your session has expired. Please sign in again.";
const CONNECTION_ERROR = "We couldn't save your changes. Please try again.";

export async function saveProfile(input: ProfileInput): Promise<SettingsResult> {
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your name." };
  try {
    const auth = await authenticatedClient();
    if (!auth) return { success: false, error: SESSION_ERROR };
    const { data, error } = await auth.supabase.from("profiles")
      .update({ display_name: parsed.data.displayName }).eq("id", auth.user.id).select("id").maybeSingle();
    if (error || !data) return { success: false, error: "We couldn't update your profile. Check that the latest database update has been applied." };
    refreshPages();
    return { success: true };
  } catch { return { success: false, error: CONNECTION_ERROR }; }
}

export async function saveThemePreference(theme: ThemePreference): Promise<SettingsResult> {
  const parsed = themePreferenceSchema.safeParse(theme);
  if (!parsed.success) return { success: false, error: "Choose light, dark, or system." };
  try {
    const auth = await authenticatedClient();
    if (!auth) return { success: false, error: SESSION_ERROR };
    const { data, error } = await auth.supabase.from("profiles")
      .update({ theme_preference: parsed.data }).eq("id", auth.user.id).select("id").maybeSingle();
    if (error || !data) return { success: false, error: "Your theme could not be saved to your account. Please try again." };
    refreshPages();
    return { success: true };
  } catch { return { success: false, error: CONNECTION_ERROR }; }
}

export async function updateCategory(input: CategoryUpdateInput): Promise<SettingsResult> {
  const parsed = categoryUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the category." };
  try {
    const auth = await authenticatedClient();
    if (!auth) return { success: false, error: SESSION_ERROR };
    const { data, error } = await auth.supabase.from("categories")
      .update({ name: parsed.data.name, icon: parsed.data.icon })
      .eq("id", parsed.data.categoryId).eq("user_id", auth.user.id).select("id").maybeSingle();
    if (error || !data) return { success: false, error: "That category could not be updated. Refresh and try again." };
    refreshPages();
    return { success: true };
  } catch { return { success: false, error: CONNECTION_ERROR }; }
}

export async function deleteCategory(categoryId: string): Promise<SettingsResult> {
  if (!z.string().uuid().safeParse(categoryId).success) return { success: false, error: "That category could not be found." };
  try {
    const auth = await authenticatedClient();
    if (!auth) return { success: false, error: SESSION_ERROR };
    const { data, error } = await auth.supabase.from("categories").delete()
      .eq("id", categoryId).eq("user_id", auth.user.id).select("id").maybeSingle();
    if (error?.code === "23503") return { success: false, error: "This category is used by a recurring payment. Change its category first." };
    if (error || !data) return { success: false, error: "That category could not be deleted. Refresh and try again." };
    refreshPages();
    return { success: true };
  } catch { return { success: false, error: CONNECTION_ERROR }; }
}

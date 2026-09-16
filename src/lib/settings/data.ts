import "server-only";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { themePreferenceSchema } from "./validation";
import type { SettingsData } from "./types";

const walletSchema = z.object({ id: z.string().uuid(), name: z.string(), currency: z.string(),
  balance_minor: z.union([z.number(), z.string().regex(/^-?\d+$/).transform(Number)]).refine(Number.isSafeInteger),
  color: z.string().nullable(), is_default: z.boolean(),
});
const categorySchema = z.object({ id: z.string().uuid(), name: z.string(), type: z.enum(["expense", "income"]),
  icon: z.string().nullable(), color: z.string().nullable(),
});
export async function getSettingsData(): Promise<SettingsData> {
  const [supabase, user] = await Promise.all([createClient(), getAuthedUser()]);
  const base: SettingsData = { email: user.email, displayName: user.name ? user.name.slice(0, 80) : (user.email.split("@")[0] || ""),
    themePreference: "system", wallets: [], categories: [], error: null };
  try {
    const [profile, wallets, categories] = await Promise.all([
      supabase.from("profiles").select("display_name,theme_preference").eq("id", user.id).maybeSingle(),
      supabase.from("wallets").select("id,name,currency,balance_minor,color,is_default", { count: "exact" }).eq("user_id", user.id).order("created_at").range(0, 999),
      supabase.from("categories").select("id,name,type,icon,color", { count: "exact" }).eq("user_id", user.id).eq("is_archived", false).order("name").range(0, 999),
    ]);
    if (profile.error || !profile.data) return { ...base, error: "Settings are not ready yet. Apply the latest database update, then refresh." };
    if (wallets.error || categories.error || wallets.count === null || categories.count === null) return { ...base, error: "We couldn't load your settings. Please refresh and try again." };
    if (wallets.count > 1000 || categories.count > 1000) return { ...base, error: "This account has more than 1,000 wallets or categories. Settings cannot display a partial list." };
    const walletRows = z.array(walletSchema).parse(wallets.data);
    const categoryRows = z.array(categorySchema).parse(categories.data);
    return { ...base,
      displayName: typeof profile.data.display_name === "string" && profile.data.display_name.trim() ? profile.data.display_name.trim() : base.displayName,
      themePreference: themePreferenceSchema.parse(profile.data.theme_preference),
      wallets: walletRows.map((row) => ({ id: row.id, name: row.name, currency: row.currency, balanceMinor: row.balance_minor, color: row.color, isDefault: row.is_default })),
      categories: categoryRows,
    };
  } catch { return { ...base, error: "We couldn't load your settings safely. Please refresh and try again." }; }
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createMerchantSchema, MERCHANT_COLUMNS, merchantSchema, type Merchant } from "@/lib/merchants/model";

type DirectoryResult = { success: true; merchants: Merchant[] } | { success: false; error: string };
type CreateResult = { success: true; merchant: Merchant } | { success: false; error: string };

export async function loadMerchants(): Promise<DirectoryResult> {
  try {
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user || !isAllowedEmail(user.email)) return { success: false, error: "Sign in again to load merchants." };
    const merchants: Merchant[] = [];
    // Paginate instead of silently truncating personal directories at PostgREST's row limit.
    for (let offset = 0; offset < 10000; offset += 500) {
      const result = await db.from("merchants").select(MERCHANT_COLUMNS, { count: "exact" })
        .or(`user_id.is.null,user_id.eq.${user.id}`).order("name").order("id").range(offset, offset + 499);
      if (result.error) { console.error("Merchant directory:", result.error); return { success: false, error: "Couldn't load merchants. Try again." }; }
      const parsed = z.array(merchantSchema).safeParse(result.data);
      if (!parsed.success || result.count === null || result.count > 10000) return { success: false, error: "Couldn't load the complete merchant directory." };
      merchants.push(...parsed.data);
      if (merchants.length >= result.count) return { success: true, merchants };
      if (parsed.data.length === 0) break;
    }
    return { success: false, error: "Your merchant directory changed while loading. Try again." };
  } catch { return { success: false, error: "Couldn't connect to your merchant directory." }; }
}

export async function createMerchant(input: { name: string; categoryId: string | null }): Promise<CreateResult> {
  const parsed = createMerchantSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the merchant name." };
  try {
    const db = await createClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user || !isAllowedEmail(user.email)) return { success: false, error: "Sign in again to add a merchant." };
    // RLS also verifies the category belongs to the caller.
    const { data, error } = await db.from("merchants").insert({
      user_id: user.id, name: parsed.data.name, category_id: parsed.data.categoryId,
    }).select(MERCHANT_COLUMNS).single();
    if (error?.code === "23505") {
      // A double click or concurrent tab should select the existing entry.
      const directory = await loadMerchants();
      const existing = directory.success ? directory.merchants.find((m) => m.user_id === user.id && m.name.trim().toLowerCase() === parsed.data.name.toLowerCase()) : undefined;
      if (existing) return { success: true, merchant: existing };
    }
    if (error) { console.error("Merchant creation:", error); return { success: false, error: "Couldn't add this merchant. Check its category and try again." }; }
    const merchant = merchantSchema.safeParse(data);
    if (!merchant.success) return { success: false, error: "Couldn't verify the saved merchant. Search again before retrying." };
    revalidatePath("/dashboard"); revalidatePath("/transactions");
    return { success: true, merchant: merchant.data };
  } catch { return { success: false, error: "Couldn't connect. Please try again." }; }
}

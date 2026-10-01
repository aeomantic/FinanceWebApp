import { z } from "zod";

export const merchantSchema = z.object({
  id: z.string().uuid(), user_id: z.string().uuid().nullable(), name: z.string(),
  category_id: z.string().uuid().nullable(), category_key: z.string().nullable(),
  icon_name: z.string(), logo_url: z.string().nullable(), brand_color: z.string(),
});
export type Merchant = z.infer<typeof merchantSchema>;
export const MERCHANT_COLUMNS = "id,user_id,name,category_id,category_key,icon_name,logo_url,brand_color";
export const merchantNameSchema = z.string().trim().min(1, "Enter a merchant name.")
  .max(80, "Keep merchant names under 80 characters.")
  .refine((value) => !/[\p{Cc}]/u.test(value), "Remove control characters from the name.");
export const createMerchantSchema = z.object({ name: merchantNameSchema, categoryId: z.string().uuid().nullable() });
export function categoryKey(name: string): string | null {
  const value = name.toLowerCase();
  if (/grocer|supermarket/.test(value)) return "groceries";
  if (/food|dining|restaurant|coffee|meal/.test(value)) return "food";
  if (/transport|travel|commut|taxi|bus|mrt/.test(value)) return "transport";
  if (/shopping|electronic|retail/.test(value)) return "shopping";
  return null;
}
export function suggestMerchants(merchants: Merchant[], categoryId: string | null, categoryName = ""): Merchant[] {
  if (!categoryId) return [];
  const key = categoryKey(categoryName);
  return merchants.filter((m) => m.category_id === categoryId || (m.user_id === null && key !== null && m.category_key === key));
}
export function matchMerchants(merchants: Merchant[], query: string): Merchant[] {
  const normalized = query.trim().toLocaleLowerCase("en-US");
  return merchants.filter((m) => m.name.toLocaleLowerCase("en-US").includes(normalized));
}

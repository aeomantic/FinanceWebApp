import { z } from "zod";
export const themePreferenceSchema = z.enum(["light", "dark", "system"]);
export const profileInputSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your display name.").max(80, "Keep your name under 80 characters.")
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Use a name without control characters."),
});
export const categoryUpdateSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a category name.").max(60, "Keep the name under 60 characters."),
  icon: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, "Choose a category icon."),
});

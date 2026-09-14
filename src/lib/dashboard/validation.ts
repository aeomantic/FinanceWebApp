import { z } from "zod";
import { isValidDate, SUPPORTED_CURRENCIES } from "./summary";

/** Convert decimal text directly, without binary floating point multiplication. */
export function parseAmountMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,14}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const amount = Number(`${whole}${fraction.padEnd(2, "0")}`);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export const uuidSchema = z.string().uuid();

const baseTransactionSchema = z.object({
  walletId: uuidSchema,
  destinationWalletId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  amount: z.string().max(32).refine((value) => parseAmountMinor(value) !== null, "Enter a positive amount with up to two decimal places."),
  date: z.string().refine(isValidDate, "Choose a valid date."),
  type: z.enum(["income", "expense", "transfer"], { error: "Choose income, expense, or transfer." }),
  note: z.string().trim().max(120, "Keep the note under 120 characters.").optional(),
});

export const transactionInputSchema = baseTransactionSchema.check((ctx) => {
  const { type, destinationWalletId, walletId } = ctx.value;
  if (type === "transfer") {
    if (!destinationWalletId) {
      ctx.issues.push({ code: "custom", message: "Choose a destination wallet.", path: ["destinationWalletId"], input: ctx.value });
    } else if (destinationWalletId === walletId) {
      ctx.issues.push({ code: "custom", message: "Choose a different destination wallet.", path: ["destinationWalletId"], input: ctx.value });
    }
  }
});

export const walletInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a wallet name.").max(60, "Keep the name under 60 characters."),
  currency: z.enum(SUPPORTED_CURRENCIES, { error: "Choose a supported currency." }),
  color: z.string().trim().max(30).optional(),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(60, "Keep the name under 60 characters."),
  type: z.enum(["expense", "income"], { error: "Choose expense or income." }),
  icon: z.string().trim().max(40).optional(),
});

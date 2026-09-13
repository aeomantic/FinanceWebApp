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

export const transactionInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a person or merchant name.").max(120, "Keep the name under 120 characters."),
  amount: z.string().max(32).refine((value) => parseAmountMinor(value) !== null, "Enter a positive amount with up to two decimal places."),
  currency: z.enum(SUPPORTED_CURRENCIES, { error: "Choose a supported currency." }),
  date: z.string().refine(isValidDate, "Choose a valid date."),
  type: z.enum(["income", "expense"], { error: "Choose income or expense." }),
});

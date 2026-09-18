import { z } from "zod";
import { isValidDate, SUPPORTED_CURRENCIES } from "@/lib/dashboard/summary";
import { parseAmountMinor, uuidSchema } from "@/lib/dashboard/validation";

const amountField = z.string().max(32).refine((value) => parseAmountMinor(value) !== null, "Enter a positive amount with up to two decimal places.");
const titleField = z.string().trim().min(1, "Enter a name.").max(80, "Keep the name under 80 characters.");
const iconField = z.string().trim().max(40).optional();
const deadlineField = z.string().refine(isValidDate, "Choose a valid date.").optional();
const currencyField = z.enum(SUPPORTED_CURRENCIES, { error: "Choose a supported currency." });

export const createGoalInputSchema = z.object({
  title: titleField,
  target: amountField,
  saved: amountField.optional(),
  currency: currencyField,
  deadline: deadlineField,
  icon: iconField,
});

export const depositToGoalInputSchema = z.object({
  id: uuidSchema,
  amount: amountField,
  updatedAt: z.string().min(1),
});

/** Goal mutations carry the last-read updated_at as an optimistic-concurrency guard. */
export const goalMutationSchema = z.object({ id: uuidSchema, updatedAt: z.string().min(1) });

/** wishlist_items has no updated_at column, so wish mutations are id-scoped only. */
export const wishMutationSchema = z.object({ id: uuidSchema });

export const createWishInputSchema = z.object({
  name: titleField,
  price: amountField.optional(),
  url: z.string().trim().max(300, "Keep the link under 300 characters.").refine((value) => /^https?:\/\/\S+$/i.test(value), "Enter a full link starting with http:// or https://").optional(),
  note: z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
  icon: iconField,
});

export const convertWishInputSchema = z.object({
  id: uuidSchema,
  target: amountField,
  currency: currencyField,
  deadline: deadlineField,
});

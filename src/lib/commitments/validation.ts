import { z } from "zod";
import { isValidDate } from "../dashboard/summary";
import { parseAmountMinor, uuidSchema } from "../dashboard/validation";
import type { BillingFrequency } from "./types";

/** Calendar addition always uses the original anchor, preserving month-end and leap-day intent. */
export function scheduledDate(anchor: string, frequency: BillingFrequency, index: number, intervalCount = 1): string {
  if (!isValidDate(anchor) || !Number.isSafeInteger(index) || index < 0 || index > 10000 || !Number.isSafeInteger(intervalCount) || intervalCount < 1 || intervalCount > 120) {
    throw new RangeError("Invalid schedule.");
  }
  const date = new Date(`${anchor}T00:00:00.000Z`);
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7 * index);
  else {
    const months = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : frequency === "custom_months" ? intervalCount : 1;
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months * index);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  const result = date.toISOString().slice(0, 10);
  if (!isValidDate(result)) throw new RangeError("Schedule exceeds the supported calendar range.");
  return result;
}

export const commitmentInputSchema = z.object({
  id: uuidSchema.optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
  name: z.string().trim().min(1, "Enter a title.").max(80, "Keep the title under 80 characters."),
  amount: z.string().max(32).refine((value) => parseAmountMinor(value) !== null, "Enter a positive amount with up to two decimal places."),
  walletId: uuidSchema,
  categoryId: uuidSchema.optional(),
  obligationType: z.enum(["subscription", "bnpl"]),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly", "custom_months"]),
  intervalCount: z.number().int().min(1).max(120),
  nextDueOn: z.string().refine(isValidDate, "Choose a valid next due date."),
  totalInstallments: z.number().int().min(1).max(600).optional(),
  paidInstallments: z.number().int().min(0).max(600),
  endDate: z.string().refine(isValidDate, "Choose a valid payoff deadline.").optional(),
  icon: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/, "Choose an icon."),
}).superRefine((value, ctx) => {
  if (value.id && !value.updatedAt) ctx.addIssue({ code: "custom", path: ["updatedAt"], message: "Refresh this commitment before editing." });
  if (value.obligationType !== "bnpl") return;
  if (!value.totalInstallments || !value.endDate) {
    ctx.addIssue({ code: "custom", path: ["totalInstallments"], message: "Set the installment count and payoff deadline." });
    return;
  }
  if (value.paidInstallments > value.totalInstallments) {
    ctx.addIssue({ code: "custom", path: ["paidInstallments"], message: "Paid installments cannot exceed the total." });
    return;
  }
  const amount = parseAmountMinor(value.amount);
  if (amount !== null && !Number.isSafeInteger(amount * value.totalInstallments)) ctx.addIssue({ code: "custom", path: ["amount"], message: "The total commitment exceeds the supported money range." });
  const remaining = value.totalInstallments - value.paidInstallments;
  if (remaining > 0) {
    try {
      const lastDue = scheduledDate(value.nextDueOn, value.frequency, remaining - 1, value.intervalCount);
      if (lastDue > value.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: `The deadline must be on or after the final scheduled payment (${lastDue}).` });
    } catch {
      ctx.addIssue({ code: "custom", path: ["nextDueOn"], message: "These dates exceed the supported calendar range." });
    }
  }
});

export const commitmentMutationSchema = z.object({ id: uuidSchema, updatedAt: z.string().datetime({ offset: true }) });

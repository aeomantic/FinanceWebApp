import { z } from "zod";

export const SECTORS = ["Technology", "Index Fund / ETF", "Finance", "Healthcare", "Consumer", "Energy", "Crypto", "Other"] as const;
export const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.:-]{0,24}$/;
/** JSON numbers can use exponent notation even when a decimal was entered. */
export function investmentDecimal(value: number | string): string {
  return typeof value === "number" ? value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 }) : value;
}
const decimal = z.string().trim().regex(/^\d+(?:\.\d{1,8})?$/, "Use a positive decimal with up to 8 decimal places.").transform(Number).refine(Number.isFinite);
export const investmentSchema = z.object({
  id: z.string().uuid().optional(),
  ticker: z.string().trim().toUpperCase().regex(TICKER_PATTERN, "Enter a valid ticker symbol."),
  name: z.string().trim().min(1, "Enter the asset name.").max(100),
  shares: decimal.refine(n => n > 0 && n <= 1e9, "Shares must be greater than zero and at most 1 billion."),
  buy_price: decimal.refine(n => n >= 0 && n <= 1e9, "Price must be between zero and 1 billion."),
  currency: z.enum(["USD", "SGD", "MYR", "EUR", "GBP", "JPY", "AUD", "CAD", "HKD"]),
  sector: z.enum(SECTORS),
  wallet_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine(p => p.shares * p.buy_price <= 1e12, { message: "Cost basis must not exceed 1 trillion.", path: ["buy_price"] });
export type InvestmentInput = z.input<typeof investmentSchema>;

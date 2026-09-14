import type { CurrencySummary, MonthlySpendPoint, Transaction } from "./types";

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "SGD", "AUD", "CAD", "CHF"] as const;

/** The ledger currently records currencies with two decimal minor units. */
export function formatMoney(amountMinor: number, currency = "USD"): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError("Money must be represented by safe integer minor units.");
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const magnitude = Math.abs(amountMinor);
  const whole = Math.floor(magnitude / 100);
  const fraction = String(magnitude % 100).padStart(2, "0");
  // Formatting each part separately preserves cents near Number.MAX_SAFE_INTEGER.
  return formatter.formatToParts(amountMinor < 0 ? -whole : whole)
    .map((part) => part.type === "fraction" ? fraction : part.value).join("");
}

/** A privacy-masked stand-in for formatMoney, same shape without the digits. */
export function maskMoney(currency = "USD"): string {
  return `${currency} ••••••`;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function getPeriodStart(today: string): string {
  if (!isValidDate(today)) throw new RangeError("A valid ISO calendar date is required.");
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 11);
  return date.toISOString().slice(0, 10);
}

export function getTransactionCurrencies(transactions: readonly Transaction[]): string[] {
  return Array.from(new Set(transactions.map((transaction) => transaction.currency))).sort();
}

function addMinorUnits(total: number, amount: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(total + amount)) {
    throw new RangeError("The recorded amounts exceed the supported money range.");
  }
  return total + amount;
}

/** Totals stay in one currency. Income and expenses are positive magnitudes. */
export function summarizeTransactions(
  transactions: readonly Transaction[],
  currency: string,
  today: string,
): CurrencySummary {
  const periodStart = getPeriodStart(today);
  const date = new Date(`${periodStart}T00:00:00.000Z`);
  const monthKeys: string[] = [];
  const monthlyPoints: MonthlySpendPoint[] = [];

  for (let month = 0; month < 12; month += 1) {
    monthKeys.push(date.toISOString().slice(0, 7));
    monthlyPoints.push({
      label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      amountMinor: 0,
    });
    date.setUTCMonth(date.getUTCMonth() + 1);
  }

  let incomeMinor = 0;
  let expensesMinor = 0;

  for (const transaction of transactions) {
    if (transaction.currency !== currency || transaction.date < periodStart || transaction.date > today) continue;
    if (!isValidDate(transaction.date)) throw new RangeError("A transaction contains an invalid date.");

    if (transaction.type === "income") {
      incomeMinor = addMinorUnits(incomeMinor, transaction.amountMinor);
    } else {
      expensesMinor = addMinorUnits(expensesMinor, transaction.amountMinor);
      const point = monthlyPoints[monthKeys.indexOf(transaction.date.slice(0, 7))];
      point.amountMinor = addMinorUnits(point.amountMinor, transaction.amountMinor);
    }
  }

  return { currency, balanceMinor: incomeMinor - expensesMinor, incomeMinor, expensesMinor, monthlyPoints };
}

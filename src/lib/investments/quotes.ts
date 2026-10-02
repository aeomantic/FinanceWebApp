export interface StockQuote {
  ticker: string;
  price: number | null;
  dailyChangePercent: number | null;
  asOf: string | null;
  status: "available" | "unavailable" | "rate_limited" | "not_configured";
  currency: "USD";
}
export const QUOTE_TTL_MS = 60_000;
export const MAX_QUOTE_BATCH = 20;

/** This adapter covers US-listed stocks/ETFs in USD. Other listings retain
 * their cost basis. It never guesses FX conversion or prices crypto as USD. */
const US_SYMBOL = /^[A-Z]{1,5}(?:[.-][AB])?$/;
export function unavailableQuote(ticker: string, status: StockQuote["status"] = "unavailable"): StockQuote {
  return { ticker, price: null, dailyChangePercent: null, asOf: null, status, currency: "USD" };
}

export function createQuoteService({ fetcher = fetch, now = Date.now, apiKey = () => process.env.FINNHUB_API_KEY }: {
  fetcher?: typeof fetch; now?: () => number; apiKey?: () => string | undefined;
} = {}) {
  const cache = new Map<string, { expires: number; quote: StockQuote }>();
  const pending = new Map<string, Promise<StockQuote>>();
  let cooldownUntil = 0;
  let windowStart = 0;
  let requests = 0;
  let secondStart = 0;
  let burstRequests = 0;
  async function load(ticker: string): Promise<StockQuote> {
    const key = apiKey();
    if (!key) return unavailableQuote(ticker, "not_configured");
    if (now() - windowStart >= 60_000) { windowStart = now(); requests = 0; }
    if (now() - secondStart >= 1000) { secondStart = now(); burstRequests = 0; }
    if (now() < cooldownUntil || requests >= 50 || burstRequests >= 25) return unavailableQuote(ticker, "rate_limited");
    requests++;
    burstRequests++;
    try {
      const response = await fetcher(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}`, {
        headers: { "X-Finnhub-Token": key },
        cache: "force-cache",
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 429) {
        const retry = Number(response.headers.get("retry-after"));
        cooldownUntil = now() + Math.max(60, Math.min(Number.isFinite(retry) ? retry : 60, 3600)) * 1000;
        return unavailableQuote(ticker, "rate_limited");
      }
      if (!response.ok) return unavailableQuote(ticker);
      const raw: unknown = await response.json();
      if (!raw || typeof raw !== "object") return unavailableQuote(ticker);
      const data = raw as Record<string, unknown>;
      if (typeof data.c !== "number" || !Number.isFinite(data.c) || data.c <= 0 || data.c > 1e9 ||
          typeof data.t !== "number" || !Number.isFinite(data.t) || data.t <= 0 || data.t * 1000 > now() + 300_000) return unavailableQuote(ticker);
      return { ticker, price: data.c, dailyChangePercent: typeof data.dp === "number" && Number.isFinite(data.dp) ? data.dp : null,
        asOf: new Date(data.t * 1000).toISOString(), status: "available", currency: "USD" };
    } catch { return unavailableQuote(ticker); }
  }
  function getQuote(raw: string): Promise<StockQuote> {
    const ticker = raw.trim().toUpperCase();
    if (!US_SYMBOL.test(ticker)) return Promise.resolve(unavailableQuote(ticker));
    const cached = cache.get(ticker);
    if (cached && cached.expires > now()) return Promise.resolve(cached.quote);
    const existing = pending.get(ticker);
    if (existing) return existing;
    const promise = load(ticker).then(quote => {
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      // Negative results are cached too: invalid tickers and outages must not
      // hammer the provider on every page render or button click.
      cache.set(ticker, { quote, expires: now() + QUOTE_TTL_MS });
      return quote;
    }).finally(() => pending.delete(ticker));
    pending.set(ticker, promise);
    return promise;
  }
  async function getQuotes(tickers: string[]): Promise<StockQuote[]> {
    const unique = [...new Set(tickers.map(t => t.trim().toUpperCase()))];
    const results: StockQuote[] = [];
    // Bound parallel misses and total wait time; request budgets apply across
    // simultaneous batches, not just within an individual HTTP request.
    for (let i = 0; i < unique.length; i += 4) results.push(...await Promise.all(unique.slice(i, i + 4).map(getQuote)));
    return results;
  }
  return { getQuote, getQuotes };
}

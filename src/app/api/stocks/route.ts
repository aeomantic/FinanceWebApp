import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { stockQuotes } from "@/lib/investments/quote-service";
import { MAX_QUOTE_BATCH } from "@/lib/investments/quotes";
import { TICKER_PATTERN } from "@/lib/investments/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user || !isAllowedEmail(user.email)) return Response.json({ error: "Please sign in." }, { status: 401, headers });
    const params = new URL(request.url).searchParams;
    const raw = params.get("symbols") ?? params.get("symbol") ?? "";
    if (raw.length > 520) return Response.json({ error: "Request up to 20 ticker symbols." }, { status: 400, headers });
    const symbols = [...new Set(raw.split(",").map(t => t.trim().toUpperCase()))];
    if (!symbols.length || symbols.length > MAX_QUOTE_BATCH || symbols.some(t => !TICKER_PATTERN.test(t))) {
      return Response.json({ error: "Provide 1–20 valid ticker symbols." }, { status: 400, headers });
    }
    const quotes = await stockQuotes.getQuotes(symbols);
    return Response.json({ quotes, cacheSeconds: 60 }, { headers });
  } catch { return Response.json({ error: "Quotes are temporarily unavailable." }, { status: 503, headers }); }
}

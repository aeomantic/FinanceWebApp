import "server-only";
import { createQuoteService } from "./quotes";

// Module singleton coalesces concurrent requests and enforces negative caching.
// Successful fetches also use Next's persistent Data Cache across requests.
export const stockQuotes = createQuoteService();

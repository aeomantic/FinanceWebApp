import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Route Handlers pass their response headers so SDK cache protections travel
// with cookie writes. Server Components cannot write a response; the proxy
// refreshes their sessions and applies the same protections before rendering.
export async function createClient(responseHeaders?: Headers) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          Object.entries(cacheHeaders).forEach(([name, value]) => responseHeaders?.set(name, value));
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; the proxy refreshes its session.
          }
        },
      },
    },
  );
}

import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
  "/api/auth/password",
  "/preview",
]);

// Refresh and authorize every request. Redirects must carry rotated or
// deleted auth cookies as well as ordinary responses.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const authHeaders = new Headers();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          Object.entries(cacheHeaders).forEach(([name, value]) => authHeaders.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          authHeaders.forEach((value, name) => supabaseResponse.headers.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  function redirectWithCookies(path: string, error?: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = error ? `?error=${error}` : "";
    const response = NextResponse.redirect(url);
    authHeaders.forEach((value, name) => response.headers.set(name, value));
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return isPublicPath ? supabaseResponse : redirectWithCookies("/login", "unauthorized");
  }

  if (!user && !isPublicPath) return redirectWithCookies("/login");
  if (user && (pathname === "/login" || pathname === "/register")) {
    return redirectWithCookies("/dashboard");
  }
  return supabaseResponse;
}

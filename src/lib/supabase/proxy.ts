import { isAllowedEmail } from "@/lib/auth/allowlist";
import { USER_EMAIL_HEADER, USER_ID_HEADER, USER_NAME_HEADER } from "@/lib/auth/identity-headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
  "/api/auth/password",
  "/preview",
  // The PWA manifest is fetched by the browser without a session (e.g. on the
  // login screen, before install); it must never redirect to /login or the
  // install prompt and home-screen icon break. Its icons already bypass the
  // proxy via the static-asset matcher.
  "/manifest.webmanifest",
]);

// Refresh and authorize every request. Redirects must carry rotated or
// deleted auth cookies as well as ordinary responses.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const authHeaders = new Headers();

  // Identity we forward to Server Components once the JWT is validated below,
  // so their data loaders skip a second getUser(). Strip any client-supplied
  // copies first: only this proxy, after validating, may set them.
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete(USER_ID_HEADER);
  forwardHeaders.delete(USER_EMAIL_HEADER);
  forwardHeaders.delete(USER_NAME_HEADER);
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
  if (user && pathname === "/login") {
    return redirectWithCookies("/dashboard");
  }

  // Reaching here, an authenticated request is being served (or a public path
  // with no user). Forward the validated identity so page data loaders can
  // trust it without re-calling the auth server. Carry over the refreshed
  // cookies (and any SDK cache headers) the session refresh produced.
  if (user) {
    forwardHeaders.set(USER_ID_HEADER, user.id);
    forwardHeaders.set(USER_EMAIL_HEADER, user.email ?? "");
    const metadataName: unknown = user.user_metadata?.full_name ?? user.user_metadata?.name;
    if (typeof metadataName === "string" && metadataName.trim()) {
      forwardHeaders.set(USER_NAME_HEADER, encodeURIComponent(metadataName.trim()));
    }
  }
  const forwarded = NextResponse.next({ request: { headers: forwardHeaders } });
  authHeaders.forEach((value, name) => forwarded.headers.set(name, value));
  supabaseResponse.cookies.getAll().forEach((cookie) => forwarded.cookies.set(cookie));
  return forwarded;
}

import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { AUTH_CACHE_HEADERS } from "@/lib/supabase/cache";
import { NextResponse, type NextRequest } from "next/server";

// Handles email confirmation and password recovery PKCE redirects. This is the point of
// session creation, so the allowlist is enforced here server-side: a
// session for any other email is signed out before this handler returns,
// not just hidden behind a client-side redirect.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;
  const responseHeaders = new Headers(AUTH_CACHE_HEADERS);
  const redirectTo = (url: string) => NextResponse.redirect(url, { headers: responseHeaders });

  if (!code) {
    return redirectTo(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient(responseHeaders);
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return redirectTo(`${origin}/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return redirectTo(`${origin}/login?error=unauthorized`);
  }

  const { error: upsertError } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
  });

  if (upsertError) {
    console.error("Profile upsert failed:", {
      code: upsertError.code,
      message: upsertError.message,
      details: upsertError.details,
      hint: upsertError.hint,
    });
    await supabase.auth.signOut();
    return redirectTo(`${origin}/login?error=profile_setup_failed`);
  }

  const destination = request.nextUrl.searchParams.get("next") === "/auth/reset-password"
    ? "/auth/reset-password"
    : "/dashboard";
  return redirectTo(`${origin}${destination}`);
}

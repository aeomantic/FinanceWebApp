import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// Handles the redirect back from Google via Supabase. This is the point
// of session creation, so the allowlist is enforced here server-side: a
// session for any other email is signed out before this handler returns,
// not just hidden behind a client-side redirect.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=unauthorized`);
  }

  const googleSub = user.identities?.find((identity) => identity.provider === "google")
    ?.identity_data?.sub as string | undefined;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("google_sub")
    .eq("id", user.id)
    .maybeSingle();

  // Once a google_sub has been recorded for this profile, later logins must
  // match it. Guards against the rare case of the email being reassigned to
  // a different Google account after the allowlist was set up.
  if (existingProfile?.google_sub && googleSub && existingProfile.google_sub !== googleSub) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=identity_mismatch`);
  }

  const { error: upsertError } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    google_sub: googleSub ?? existingProfile?.google_sub ?? null,
  });

  if (upsertError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=profile_setup_failed`);
  }

  return NextResponse.redirect(`${origin}/`);
}

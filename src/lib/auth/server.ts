import { isAllowedEmail } from "@/lib/auth/allowlist";
import { getAuthErrorMessage, type AuthRequest, type AuthResult } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

const CONFIRMATION_MESSAGE = "If this email is eligible, check your inbox to confirm your account. You can then sign in with your password.";
const RECOVERY_MESSAGE = "If an account exists for this email, you'll receive a password reset link shortly.";

export async function ensureProfile(supabase: SupabaseClient, user: User): Promise<boolean> {
  const { error } = await supabase.from("profiles").upsert({ id: user.id, email: user.email });
  if (!error) return true;

  console.error("Profile upsert failed:", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  await supabase.auth.signOut();
  return false;
}

async function completeSignIn(supabase: SupabaseClient, session: Session): Promise<AuthResult> {
  if (!isAllowedEmail(session.user.email)) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is not authorized to use this app." };
  }

  if (!(await ensureProfile(supabase, session.user))) {
    return { ok: false, error: "Could not set up your profile. Please try again." };
  }

  return {
    ok: true,
    session: { access_token: session.access_token, refresh_token: session.refresh_token },
  };
}

export async function signInWithPassword(email: string, password: string, responseHeaders?: Headers): Promise<AuthResult> {
  // Keep the owner allowlist server-side. A disallowed address receives the
  // same error as an incorrect password without creating a Supabase session.
  if (!isAllowedEmail(email)) {
    return { ok: false, error: "Invalid login credentials. Check your email and password." };
  }
  const supabase = await createClient(responseHeaders);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: getAuthErrorMessage(error) };
  return completeSignIn(supabase, data.session);
}

export async function signUp(email: string, password: string, origin: string, responseHeaders?: Headers): Promise<AuthResult> {
  if (!isAllowedEmail(email)) return { ok: true, message: CONFIRMATION_MESSAGE };

  const supabase = await createClient(responseHeaders);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { ok: false, error: getAuthErrorMessage(error) };

  // Supabase can deliberately return an obfuscated user for a duplicate signup.
  if (data.user?.identities?.length === 0) {
    return { ok: false, error: "User already registered. Sign in or reset your password." };
  }
  if (data.session) return completeSignIn(supabase, data.session);
  return { ok: true, message: CONFIRMATION_MESSAGE };
}

export async function resetPasswordForEmail(email: string, origin: string, responseHeaders?: Headers): Promise<AuthResult> {
  if (!isAllowedEmail(email)) return { ok: true, message: RECOVERY_MESSAGE };

  const supabase = await createClient(responseHeaders);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });
  if (error) return { ok: false, error: getAuthErrorMessage(error) };
  return { ok: true, message: RECOVERY_MESSAGE };
}

export async function updatePassword(password: string, responseHeaders?: Headers): Promise<AuthResult> {
  const supabase = await createClient(responseHeaders);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return { ok: false, error: "Your reset link has expired. Request a new one to continue." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: getAuthErrorMessage(error) };
  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  if (signOutError) {
    return { ok: false, error: "Your password was updated, but we couldn't end this session. Refresh the page and sign in again." };
  }
  return { ok: true, message: "Password updated. Sign in with your new password." };
}

export async function submitAuthRequest(request: AuthRequest, origin: string, responseHeaders: Headers): Promise<AuthResult> {
  switch (request.action) {
    case "login": return signInWithPassword(request.email, request.password, responseHeaders);
    case "register": return signUp(request.email, request.password, origin, responseHeaders);
    case "forgot": return resetPasswordForEmail(request.email, origin, responseHeaders);
    case "reset": return updatePassword(request.password, responseHeaders);
  }
}

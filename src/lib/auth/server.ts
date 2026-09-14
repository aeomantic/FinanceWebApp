import { isAllowedEmail } from "@/lib/auth/allowlist";
import { getAuthErrorMessage, type AuthRequest, type AuthResult } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

const RECOVERY_MESSAGE = "If an account exists for this email, you'll receive a password reset link shortly.";
const AUTH_CONFIGURATION_ERROR = "Sign-in is not configured. Ask the app owner to configure account access.";
const ACCOUNT_ACCESS_ERROR = "This app is restricted to its configured owner. This email is not authorized to sign in.";

function getAccountAccessError(email: string): string | null {
  if (!process.env.ALLOWED_EMAIL?.trim()) return AUTH_CONFIGURATION_ERROR;
  return isAllowedEmail(email) ? null : ACCOUNT_ACCESS_ERROR;
}

async function completeSignIn(supabase: SupabaseClient, session: Session): Promise<AuthResult> {
  if (!isAllowedEmail(session.user.email)) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is not authorized to use this app." };
  }

  return {
    ok: true,
    session: { access_token: session.access_token, refresh_token: session.refresh_token },
  };
}

export async function signInWithPassword(email: string, password: string, responseHeaders?: Headers): Promise<AuthResult> {
  // Explain the owner restriction without exposing the configured address.
  // A rejected request must not create a Supabase session.
  const accessError = getAccountAccessError(email);
  if (accessError) return { ok: false, error: accessError };
  const supabase = await createClient(responseHeaders);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: getAuthErrorMessage(error) };
  return completeSignIn(supabase, data.session);
}

export async function resetPasswordForEmail(email: string, origin: string, responseHeaders?: Headers): Promise<AuthResult> {
  if (!process.env.ALLOWED_EMAIL?.trim()) return { ok: false, error: AUTH_CONFIGURATION_ERROR };
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
    case "forgot": return resetPasswordForEmail(request.email, origin, responseHeaders);
    case "reset": return updatePassword(request.password, responseHeaders);
  }
}

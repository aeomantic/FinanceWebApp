"use client";

import { createClient } from "@/lib/supabase/client";
import type { AuthRequest, AuthResult, Credentials } from "@/lib/auth/validation";

async function submit(request: AuthRequest): Promise<AuthResult> {
  try {
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(request),
    });
    const result: AuthResult = await response.json();
    if (!result.ok) return result;
    if (!response.ok) return { ok: false, error: "We couldn't complete that request. Please try again." };

    if (result.session) {
      // Supabase owns cookie persistence and refresh. Adopting the session
      // also emits SIGNED_IN to the browser's onAuthStateChange listener.
      const { error } = await createClient().auth.setSession(result.session);
      if (error) return { ok: false, error: "Could not restore your session. Please sign in again." };
    }

    if (request.action === "reset") {
      await createClient().auth.signOut({ scope: "local" });
    }
    return result;
  } catch {
    return { ok: false, error: "Couldn't connect. Check your connection and try again." };
  }
}

export function signInWithPassword(credentials: Credentials): Promise<AuthResult> {
  return submit({ action: "login", ...credentials });
}

export function resetPasswordForEmail(email: string): Promise<AuthResult> {
  return submit({ action: "forgot", email });
}

export function updatePassword(password: string): Promise<AuthResult> {
  return submit({ action: "reset", password });
}

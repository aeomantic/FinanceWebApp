"use client";

import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const AuthSessionContext = createContext<Session | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Keep the current token in memory. Supabase persists and rotates its
      // own cookies, so no duplicate token is written to localStorage.
      setSession(nextSession);

      if (event === "PASSWORD_RECOVERY") {
        router.replace("/auth/reset-password");
        return;
      }

      if (event === "SIGNED_IN" && nextSession && (pathname === "/login" || pathname === "/register")) {
        router.replace("/dashboard");
        router.refresh();
      }

      if (event === "SIGNED_OUT" && (pathname === "/dashboard" || pathname === "/")) {
        router.replace("/login");
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): Session | null {
  return useContext(AuthSessionContext);
}

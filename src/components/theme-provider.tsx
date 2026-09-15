"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

function AccountThemeSync() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const supabase = createClient();
    let currentUserId: string | null = null;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        currentUserId = null;
        revision += 1;
        return;
      }
      if ((event !== "INITIAL_SESSION" && event !== "SIGNED_IN") || !session || currentUserId === session.user.id) return;
      currentUserId = session.user.id;
      const userId = session.user.id;
      const requestRevision = ++revision;
      // Schedule outside the auth callback, where another auth operation can lock.
      clearTimeout(timer);
      timer = setTimeout(() => {
        void (async () => {
          let savedLocalTheme: string | null = null;
          try { savedLocalTheme = localStorage.getItem("folio-theme"); } catch { /* Storage can be disabled. */ }
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || user.id !== userId) return;
          const { data, error } = await supabase.from("profiles").select("theme_preference").eq("id", user.id).maybeSingle();
          if (cancelled || requestRevision !== revision || error) return;
          // A preference chosen while loading takes precedence over this read.
          try { if (savedLocalTheme !== localStorage.getItem("folio-theme")) return; } catch { /* Keep the in-memory preference available. */ }
          if (data?.theme_preference === "light" || data?.theme_preference === "dark" || data?.theme_preference === "system") setTheme(data.theme_preference);
        })().catch(() => { /* The local theme remains usable when offline. */ });
      }, 0);
    });

    return () => {
      cancelled = true;
      revision += 1;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [setTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="folio-theme">
      <AccountThemeSync />
      {children}
    </NextThemesProvider>
  );
}

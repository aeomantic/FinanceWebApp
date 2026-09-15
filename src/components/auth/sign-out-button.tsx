"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) {
        setError("Could not sign out. Please try again.");
        setLoading(false);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={className ?? "rounded-full border border-black/10 px-4 py-2 text-xs font-medium text-[#71717a] transition hover:bg-white dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5 disabled:opacity-50"}>
        {loading ? "Signing out..." : "Sign out"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

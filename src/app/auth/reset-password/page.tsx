import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password | folio" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AuthShell>
      {user && isAllowedEmail(user.email) ? <AuthForm mode="reset" /> : (
        <div className="w-full max-w-[390px]">
          <h1 className="text-[34px] font-semibold tracking-[-1.5px] text-[#141414]">Let&apos;s try a fresh link.</h1>
          <p role="alert" className="mt-4 text-sm leading-6 text-[#71717a]">Your password reset link is missing or has expired. Request a new link and open it in the same browser.</p>
          <Link href="/forgot-password" className="mt-8 inline-flex h-13 w-full items-center justify-center rounded-full bg-[#141414] text-sm font-medium text-white hover:bg-[#303a34]">Request a reset link</Link>
        </div>
      )}
    </AuthShell>
  );
}

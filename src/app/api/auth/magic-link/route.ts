import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  email: z.email(),
});

// Always responds the same way whether or not the email is allowed, so the
// endpoint does not reveal which address the one account uses. Only the
// allowed email actually triggers a Supabase OTP send.
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;

  if (isAllowedEmail(email)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });

    if (error) {
      console.error("Failed to send magic link:", error.message);
    }
  }

  return NextResponse.json({ ok: true });
}

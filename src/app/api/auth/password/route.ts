import { AUTH_CACHE_HEADERS } from "@/lib/supabase/cache";
import { submitAuthRequest } from "@/lib/auth/server";
import { authRequestSchema, getFieldErrors } from "@/lib/auth/validation";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const headers = new Headers(AUTH_CACHE_HEADERS);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403, headers });
  }

  const parsed = authRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Check the highlighted fields and try again.", fieldErrors: getFieldErrors(parsed.error) },
      { status: 400, headers },
    );
  }

  try {
    const result = await submitAuthRequest(parsed.data, request.nextUrl.origin, headers);
    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers });
  } catch {
    // Never log request bodies or provider objects containing credentials.
    return NextResponse.json(
      { ok: false, error: "Authentication is temporarily unavailable. Please try again." },
      { status: 503, headers },
    );
  }
}

import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "./allowlist";
import { USER_EMAIL_HEADER, USER_ID_HEADER, USER_NAME_HEADER } from "./identity-headers";
import { createClient } from "@/lib/supabase/server";

export interface AuthedUser {
  id: string;
  email: string;
  /** The auth-metadata display name (full_name/name), if any - not the
   * `profiles.display_name` row, which data loaders read from the database. */
  name: string | null;
}

/**
 * Resolve the signed-in owner for the current request.
 *
 * Fast path: the proxy runs on every matched route, validates the JWT with a
 * real getUser(), and forwards the identity in request headers it always
 * overwrites (so a client can never inject them). Reading those headers here
 * avoids a second /auth/v1/user round-trip on the navigation critical path.
 * The Supabase queries downstream still carry the cookie JWT and stay
 * RLS-gated, so this is a latency optimisation, not a trust downgrade - a
 * wrong id could only ever intersect RLS to zero rows, never leak data.
 *
 * Fallback: if the headers are absent for any reason (a path the matcher
 * misses, a future refactor), do the authoritative getUser(). Behaviour then
 * degrades to correct-but-slower, never broken.
 *
 * cache()d so multiple loaders in one render (e.g. /transactions' dashboard +
 * upcoming-commitments reads) share a single resolution instead of repeating it.
 */
export const getAuthedUser = cache(async (): Promise<AuthedUser> => {
  const store = await headers();
  const id = store.get(USER_ID_HEADER);
  const email = store.get(USER_EMAIL_HEADER);
  if (id && email && isAllowedEmail(email)) {
    const encodedName = store.get(USER_NAME_HEADER);
    return { id, email, name: encodedName ? safeDecode(encodedName) : null };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/login?error=unauthorized");
  const metadataName: unknown = user.user_metadata?.full_name ?? user.user_metadata?.name;
  return {
    id: user.id,
    email: user.email ?? "",
    name: typeof metadataName === "string" ? metadataName : null,
  };
});

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

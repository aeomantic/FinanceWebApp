// The only identity check that matters for this app: does the verified
// email match the one owner allowed to sign in. Everything else in the
// auth flow (proxy, callback, page guards) calls this same function so
// there is exactly one place the rule can go wrong.
export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_EMAIL;
  if (!allowed || !email) return false;
  return email.trim().toLowerCase() === allowed.trim().toLowerCase();
}

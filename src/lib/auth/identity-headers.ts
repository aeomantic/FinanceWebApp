// Request headers the proxy sets, after validating the JWT with getUser(), to
// forward the signed-in owner's identity to Server Component data loaders so
// they can skip a second /auth/v1/user round-trip. Kept in their own
// dependency-free module so both the edge proxy and the server-only
// `current-user` helper can import the names without dragging server-only
// code (next/headers, react cache) into the edge runtime.
//
// The proxy ALWAYS deletes any incoming copies before setting its own, so a
// client can never inject these; and the queries downstream still carry the
// cookie JWT and remain RLS-gated, so these are a latency hint, never a trust
// boundary on their own.
export const USER_ID_HEADER = "x-folio-uid";
export const USER_EMAIL_HEADER = "x-folio-email";
export const USER_NAME_HEADER = "x-folio-name";

@AGENTS.md

# Folio (Personal Finance Webapp)

A personal finance webapp for a single user (me), called Folio: password-gated login, expense tracking, a wishlist, and recurring monthly payment tracking.

## Decided stack

* Frontend and backend: Next.js (App Router) with TypeScript
* Styling: Tailwind CSS is installed but the app doesn't use its utility classes — every component uses hand-authored CSS (`globals.css` for page-level/shared classes, a `components.module.css` per-directory for scoped ones), matching a specific soft-sage/warm-yellow palette defined as CSS custom properties. Match this palette and pattern for new UI; don't introduce Tailwind utility classes or a different color system.
* Database and auth: Supabase (Postgres, email/password auth through Supabase Auth, Row Level Security)
* Validation: Zod on all incoming form and API data, backed by database constraints
* Hosting: Vercel (Hobby plan) for the app, Supabase for the database and auth
* Charts: Recharts (`src/components/dashboard/wallet-distribution-chart.tsx` is the first real usage; `spend-chart.tsx` predates that decision and is hand-rolled SVG — leave it as is rather than migrating it speculatively)
* Icons: `lucide-react` for anything data-driven (category icons, looked up by a kebab-case string key stored in the database via `src/components/ui/category-icon.tsx`); the original hand-drawn SVG set in `src/components/ui/icon.tsx` stays for fixed chrome (nav, buttons) since it already matches the exact stroke width/style
* No UI component library (no Radix, no Headless UI): dialogs use the native `<dialog>` element (`src/components/ui/modal.tsx`), the custom dropdown (`src/components/ui/select.tsx`) is hand-rolled. Keep this pattern; a single-purpose UI library isn't worth the dependency at this app's size.

Do not propose alternative stacks or re-open this decision.

Auth history: originally planned as Google OAuth, then switched to Supabase magic link, then switched again to Supabase email/password. There is still no public registration: the single owner account is provisioned directly against Supabase (admin API or dashboard), never through a sign-up form. `/register` must not exist as a route.

## Prerequisites

1. A Supabase project with the Email provider enabled for password sign-in (no external OAuth provider needed)
2. A GitHub repository for the project (already set up: `github.com/aeomantic/FinanceWebApp`)
3. Environment variables in `.env.local` (gitignored, see `.env.example`):
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed to the client, not used by any request-serving code path — only for one-off admin scripts like provisioning the owner account)
   * `ALLOWED_EMAIL` (the only email allowed to log in)

## Data model

See `supabase/migrations/` for the schema as SQL migration files, applied in order. Do not apply schema changes by hand through the dashboard; commit a migration file instead. Migrations that need to land on the live project get pasted into the Supabase SQL Editor manually — there is no working CLI link to this project (the local `supabase` CLI login is tied to an unrelated project), and no DB password for a direct connection.

Tables: `profiles`, `wallets`, `categories`, `transactions`, `wishlist_items`, `recurring_rules`, `recurring_occurrences`.

The ledger is wallet-based (envelope style): every transaction moves money into, out of, or between wallets, not just into a category. This was a deliberate pivot from the original "categories on bare transactions" design (see `supabase/migrations/20260914053049_add_wallets_ledger_model.sql`).

* `wallets`: named balances (`balance_minor`) the owner tracks separately, e.g. "Everyday", "Food & Groceries", "Bills". Each has its own currency.
* `categories`: narrowed to `type` in (`expense`, `income`) — transfers are a transaction type now, not a category. Has `icon` for the picker UI, plus the original `color`/`is_archived`.
* `transactions`: `wallet_id` (required), `destination_wallet_id` (only for `type = 'transfer'`), `category_id` (nullable, `on delete set null`), `amount_minor` (positive magnitude, direction comes from `type`), `note` (replaces the old separate `merchant`/`notes` fields).
* A Postgres trigger (`sync_wallet_balance`) keeps `wallets.balance_minor` correct on every transaction insert/update/delete, so the balance is derived from the ledger rather than trusted from a second client-side write.
* RLS on `transactions` also verifies `wallet_id`/`destination_wallet_id`/`category_id` belong to the caller, not just `user_id` — otherwise a request could satisfy `user_id = auth.uid()` while still pointing at (and mutating the balance of) another user's wallet.
* `wallets.is_default` marks the one wallet the dashboard selects on load; a partial unique index (`wallets_one_default_per_user`, `where is_default`) enforces at most one per user at the database level. The first wallet a user creates becomes their default automatically (`createWallet` in `src/app/dashboard/actions.ts`); `setDefaultWallet` clears the old one before setting the new one, in that order, since a partial unique index only rejects two `true` rows, never zero.

**This project's live RLS policies have repeatedly not matched what the committed migration files assumed.** Phase 0's schema turned up already applied to the live project before any migration was run against it (never fully explained), and after the wallets migration landed, `transactions` INSERT, UPDATE, and SELECT policies plus all four `categories` policies turned out to be missing, misnamed, or otherwise not doing what the original migration specified — causing writes or reads to silently fail (no error, RLS just filters to zero rows) rather than throw. The fix pattern each time: `select policyname from pg_policies where schemaname = 'public' and tablename = '<table>'`, drop whatever actually exists via a `do $$ ... $$` block, recreate cleanly — never assume a policy exists under the name a migration file gives it. If something silently returns empty or a write silently no-ops against the live database, suspect RLS policy drift before anything else, and diagnose by reproducing the same operation with the service-role key (bypasses RLS) to isolate schema/payload issues from RLS issues.

Notes on the rest of the schema:

* Money is always an integer in minor units. `amount_minor = 1250` means SGD 12.50. Never use a float or JS number for stored money.
* Every table carries `user_id` even though there is one user. This keeps RLS simple and future-proofs the schema.
* A wishlist item links to a transaction only after purchase, through `purchased_transaction_id`. Wishlist and transactions stay separate: one is intent, the other is fact.
* Recurring payments follow a rule-plus-occurrences pattern, not full RRULE syntax. Five frequency values are sufficient for v1: weekly, monthly, quarterly, yearly, custom_months. Not started yet; when it is, decide how recurring bills interact with the narrowed category `type`.
* Row Level Security is enabled on every table, with policies restricting select, insert, update, and delete to rows where `user_id = auth.uid()`.

## Build order

Work through phases one at a time. After each phase, stop, summarize what was built, and wait for confirmation before starting the next one. (Note: a large chunk of Phase 2/3 landed in one uncoordinated pass outside this discipline — see status below. Return to one-phase-at-a-time from here forward.)

* Phase 0: Scaffolding — done. Next.js/TypeScript, Tailwind, Supabase clients (browser + server), env vars, repo pushed to GitHub.
* Phase 1: Authentication — done. Email/password sign-in through Supabase Auth (`/login`, `/forgot-password`, `/auth/reset-password`). Allowlist enforced server-side at session creation and re-checked on every request via the proxy, not just hidden in the UI. No registration route; the owner account is provisioned via the admin API.
* Phase 2: Wallets, categories, and transactions — partially done. `src/app/dashboard/actions.ts` has `createWallet`, `createCategory`, `setDefaultWallet`, and a transfer-aware `recordTransaction` (expense/income/transfer, wallet-scoped, optional category, `note`). Category creation is available inline from the transaction form via a custom dropdown (`src/components/ui/select.tsx`), not a native `<select>`. New accounts get a standard category taxonomy seeded automatically on first dashboard load if they have zero categories (`DEFAULT_CATEGORIES` in `src/lib/dashboard/default-categories.ts`, seeded from `getDashboardData`) — 10 expense + 6 income categories, each with a `lucide-react` icon, rendered in the category picker and in the transaction feed's avatar. Wallets support a default (starred, auto-assigned to a user's first wallet), which the dashboard selects on load. A dedicated `/wallets` page shows a Recharts donut of balance distribution (grouped by currency — currencies are never summed together) plus a full balance grid. Still needed: dedicated category management (edit/archive), a transaction edit/delete view beyond the dashboard's recent-activity list, and wallet editing beyond setting the default. Known gap: a transfer only appears in the source wallet's activity feed, not the destination's (the destination's balance still updates correctly via the DB trigger, just not its visible feed) — revisit if that matters.
* Phase 3: Dashboard — partially done. `/dashboard` shows the selected wallet's real balance (from `wallets.balance_minor`, not a derived figure) plus a 12-month income/expense summary and spend chart scoped to that wallet, computed in `src/lib/dashboard/summary.ts`. Deviation from the original plan: the summary sums in the Node server layer after fetching rows (paginated, capped at 10,000, Zod-validated), not via SQL `SUM`/`GROUP BY`. Works correctly at personal-app scale; revisit if that matters later. No date-range filter yet.
* Phase 4: Recurring payments — not started. Rules, generated occurrences, upcoming-due list, "mark paid" action that links to a transaction and advances `next_due_on`.
* Phase 5: Wishlist — not started. CRUD with priority and status, "mark purchased" action that links to a transaction.
* Phase 6: Export — not started. CSV export of transactions.

Backlog, explicitly out of scope unless asked: email or push reminders, receipt parsing, bank CSV import, AI-based categorization, multi-currency conversion beyond storing the code.

## Security requirements (non-negotiable)

* No public registration route or sign-up form, ever. The owner account is provisioned out-of-band (admin API or dashboard).
* Enforce the email allowlist server-side, at session creation, never only in the UI
* RLS enabled on every table, no exceptions; verify a logged-out request returns no data
* `SUPABASE_SERVICE_ROLE_KEY` stays server-side only, never in client code or client bundles
* HttpOnly, Secure, SameSite cookies for session state, no tokens in localStorage
* Validate everything server-side with Zod, even where the client already validates
* Never log tokens, session cookies, or full transaction payloads
* Reasonable Content Security Policy, auth redirect URLs restricted to known origins

## Working style

* Explain key decisions briefly, especially trade-offs.
* Favor plain, explicit code over adding a framework or library to save a few lines. If a dependency is genuinely worth adding, say why before adding it.
* Keep commit messages and UI copy plain text: no em dashes, no emojis.
* Ask before making a schema change that is not in the plan above.

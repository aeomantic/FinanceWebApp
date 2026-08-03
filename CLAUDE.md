@AGENTS.md

# Personal Finance Webapp

A personal finance webapp for a single user (me), with Google-gated login, expense tracking, a wishlist, and recurring monthly payment tracking.

## Decided stack

* Frontend and backend: Next.js (App Router) with TypeScript
* Styling: Tailwind CSS
* Database and auth: Supabase (Postgres, Google OAuth through Supabase Auth, Row Level Security)
* Validation: Zod on all incoming form and API data, backed by database constraints
* Hosting: Vercel (Hobby plan) for the app, Supabase for the database and auth
* Charts: Recharts

Do not propose alternative stacks or re-open this decision.

## Prerequisites

1. A Supabase project, with the Google provider enabled under Authentication > Providers
2. A Google Cloud OAuth 2.0 client (Web application type), with authorized origins and redirect URI pointing to the Supabase auth callback
3. A GitHub repository for the project
4. Environment variables in `.env.local` (gitignored, see `.env.example`):
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed to the client)
   * `ALLOWED_GOOGLE_EMAIL` (the only email allowed to log in)

## Data model

See `supabase/migrations/` for the schema as SQL migration files, applied in order. Do not apply schema changes by hand through the dashboard; commit a migration file instead.

Tables: `profiles`, `categories`, `transactions`, `wishlist_items`, `recurring_rules`, `recurring_occurrences`.

Notes on this schema:

* Money is always an integer in minor units. `amount_minor = 1250` means SGD 12.50. Never use a float or JS number for stored money.
* Every table carries `user_id` even though there is one user. This keeps RLS simple and future-proofs the schema.
* A wishlist item links to a transaction only after purchase, through `purchased_transaction_id`. Wishlist and transactions stay separate: one is intent, the other is fact.
* Recurring payments follow a rule-plus-occurrences pattern, not full RRULE syntax. Five frequency values are sufficient for v1: weekly, monthly, quarterly, yearly, custom_months.
* Row Level Security is enabled on every table, with policies restricting select, insert, update, and delete to rows where `user_id = auth.uid()`.

## Build order

Work through phases one at a time. After each phase, stop, summarize what was built, and wait for confirmation before starting the next one.

* Phase 0: Scaffolding — Next.js/TypeScript, Tailwind, Supabase clients (browser + server), env vars, repo pushed to GitHub.
* Phase 1: Authentication — Google sign-in through Supabase Auth. Allowlist enforced server-side at session creation, not just hidden in the UI. Store and check `google_sub`. No registration flow, no password fallback.
* Phase 2: Categories and transactions — CRUD, basic list view.
* Phase 3: Dashboard — monthly spending view with date range and category filters, computed with SQL aggregation, not client-side summing.
* Phase 4: Recurring payments — rules, generated occurrences, upcoming-due list, "mark paid" action that links to a transaction and advances `next_due_on`.
* Phase 5: Wishlist — CRUD with priority and status, "mark purchased" action that links to a transaction.
* Phase 6: Export — CSV export of transactions.

Backlog, explicitly out of scope unless asked: email or push reminders, receipt parsing, bank CSV import, AI-based categorization, multi-currency conversion beyond storing the code.

## Security requirements (non-negotiable)

* Enforce the email allowlist server-side, at session creation, never only in the UI
* RLS enabled on every table, no exceptions; verify a logged-out request returns no data
* `SUPABASE_SERVICE_ROLE_KEY` stays server-side only, never in client code or client bundles
* HttpOnly, Secure, SameSite cookies for session state, no tokens in localStorage
* Validate everything server-side with Zod, even where the client already validates
* Never log tokens, session cookies, or full transaction payloads
* Reasonable Content Security Policy, OAuth redirect URIs restricted to known origins

## Working style

* Explain key decisions briefly, especially trade-offs.
* Favor plain, explicit code over adding a framework or library to save a few lines. If a dependency is genuinely worth adding, say why before adding it.
* Keep commit messages and UI copy plain text: no em dashes, no emojis.
* Ask before making a schema change that is not in the plan above.

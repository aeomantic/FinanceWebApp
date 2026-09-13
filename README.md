# Folio

A personal finance journal with Supabase email/password authentication and a responsive mint-and-lime dashboard. Built with Next.js 16 App Router, TypeScript, React 19, Tailwind CSS 4, Supabase, and Zod.

## Run locally

1. Copy `.env.example` to `.env.local` and set your Supabase URL, public anon key, and `ALLOWED_EMAIL`.
2. Run `npm install`.
3. Apply the SQL migrations in `supabase/migrations/` to your Supabase project.
4. Run `npm run dev` and open [Sign in](http://localhost:3000/login).
5. Open [Explore Folio](http://localhost:3000/preview) to view the reference dashboard with clearly labeled sample data.

The existing owner-only access policy is preserved. Only `ALLOWED_EMAIL` can register or use the protected dashboard. The service-role key is not used by the new authentication or dashboard flows; queries and writes use the signed-in user's session and row-level security.

## Authentication

- `/login`: email/password sign-in, inline validation, password visibility and loading states.
- `/register`: registration, strong password validation and confirmation. A returned session opens `/dashboard`; otherwise the form asks the user to confirm their email.
- `/forgot-password`: sends a recovery email through Supabase.
- `/auth/callback`: exchanges the PKCE code, checks the owner allowlist, ensures the profile exists, and redirects to the dashboard or password reset form.
- `/auth/reset-password`: validates the session before accepting a new password. Successful changes end the local session and prompt a fresh login.

Existing magic-link users can use **Forgot password?** to set their first password. Open confirmation and recovery emails in the browser where the request started because the PKCE verifier is stored there.

Typed browser helpers are in `src/lib/auth/client.ts`. They call the validated same-origin `/api/auth/password` endpoint. Server helpers in `src/lib/auth/server.ts` call `signInWithPassword`, `signUp`, `resetPasswordForEmail` and `updateUser` while preserving the existing allowlist. This keeps the owner email private and prevents the UI from bypassing application authorization.

`AuthForm` in `src/components/auth/auth-form.tsx` handles all four form modes. `AuthSessionProvider` listens to `onAuthStateChange`, tracks the current session in memory, and routes sign-in events to `/dashboard`. Supabase owns session cookie persistence and token rotation; the app does not duplicate tokens in localStorage. Auth responses and refreshed-session responses carry no-store cache headers.

Emails are trimmed and lowercased. Passwords are never trimmed. New passwords require 8-128 characters, uppercase, lowercase, a number, and a symbol. Sign-in accepts existing passwords of 8-128 characters without imposing new complexity rules.

## Supabase configuration

The local `supabase/config.toml` includes the password policy and callback URLs. This file does **not** automatically update a hosted Supabase project's settings.

For your hosted project:

1. Enable the Email provider and allow email/password sign-in. Enable new user signups if registration is needed.
2. Choose whether email confirmation is required. Both confirmation-enabled and immediate-session signup responses are supported.
3. Set the Site URL to the deployed application origin.
4. Add exact redirect URLs for each intended origin:
   - `https://your-app.example/auth/callback`
   - `https://your-app.example/auth/callback?next=/auth/reset-password`
5. Use the same password policy as the forms: minimum 8 characters and uppercase, lowercase, numbers and symbols.
6. Configure email delivery for confirmation and password recovery. Keep the standard confirmation URL in Supabase email templates so PKCE callback handling is preserved.

For development, both `http://localhost:3000` and `http://127.0.0.1:3000` callback/recovery URLs are included in the local configuration. Hosted projects used during local development need these entries in their hosted redirect allowlist too.

## Design and dashboard components

Tailwind 4 tokens are declared with `@theme inline` in `src/app/globals.css`, so no legacy Tailwind configuration file is necessary. Shared tokens include `bg-canvas` (#EBF5F0), `bg-surface` (#FFFFFF), `bg-lime` (#FEF38B), `text-ink` (#141414), `text-positive` (#16A34A), and `rounded-card` (28px). Geist supplies the geometric sans-serif typography. The dashboard uses a responsive bento grid, rounded cards, subtle ambient shadows, and a mobile bottom navigation.

- `BalanceCard`: currency, balance privacy toggle, monthly delta and Pay/Transfer/Receive actions.
- `TransactionList`: deterministic date groups, merchant marks, credit/debit styling, search and View all.
- `SpendChart`: dotted SVG columns, yellow tooltip, keyboard exploration and working time-range selection.
- `CurrencySelector`: independent currency views and an accessible Add currency dialog.
- `DashboardShell`: navigation, top bar, statement export, ledger-entry dialogs and feedback states.

The protected dashboard reads the last 12 calendar months through today in UTC. Each currency is totaled independently. **Net recorded cashflow is income minus expenses in that period, not a bank balance.** Complete pagination is required before showing totals; query failures, unsupported data and more than 10,000 transactions show an explicit error.

Pay and Receive record ledger entries with exact integer minor units. They do not send money. Transfer explains that transfers are completed with a bank or payment provider. Live bank connections and exchange rates are not configured. `/preview` uses fictional balances and illustrative rates and disables database writes. Added currency tiles are view state for the current visit, not actual bank wallets.

## Verification

- `npm test`: 17 focused tests for email normalization, password rules, errors, exact decimal parsing, safe amounts, calendar boundaries and currency-isolated totals.
- `npm run lint`: ESLint.
- `npm run build`: production compilation and TypeScript validation.

The test runner uses the installed TypeScript compiler and Node's built-in test runner. It writes generated test files to the ignored `.tmp/` folder and does not require experimental TypeScript execution.

Local browser verification covers desktop/mobile overflow, chart ranges and keyboard controls, search, currency selection, dialogs, CSV export, guarded routes, expired recovery links, and mocked login/registration/recovery form responses. No live account registration or recovery email is sent by these checks. A real end-to-end sign-in and emailed confirmation/recovery round trip should be verified against the configured Supabase project before deployment.

## Database migrations

Schema changes live in `supabase/migrations/` and are applied in order. Create a migration with `npx supabase migration new <name>` and apply it with `npx supabase db push`. This update uses the existing schema and does not add a database migration.

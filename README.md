# Personal Finance Webapp

A personal finance webapp with magic-link-gated login, expense tracking, a wishlist, and recurring monthly payment tracking. See [CLAUDE.md](./CLAUDE.md) for the full build brief.

## Stack

Next.js (App Router, TypeScript), Tailwind CSS, Supabase (Postgres, Auth, RLS), Zod, Recharts. Hosted on Vercel.

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase project URL, anon key, service role key, and the allowed email.
2. Install dependencies: `npm install`
3. Apply database migrations to your Supabase project: `npx supabase db push` (or run the SQL in `supabase/migrations/` manually via the Supabase SQL editor)
4. Run the dev server: `npm run dev`, then open [http://localhost:3000](http://localhost:3000)

## Database migrations

Schema changes are committed as SQL files in `supabase/migrations/`, applied in order. Do not make schema changes by hand through the Supabase dashboard.

To create a new migration: `npx supabase migration new <name>`

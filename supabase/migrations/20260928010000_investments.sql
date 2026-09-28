begin;
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  wallet_id uuid references public.wallets(id) on delete set null,
  ticker text not null,
  name text not null,
  shares numeric not null check (shares > 0 and shares <= 1000000000),
  buy_price numeric not null check (buy_price >= 0 and buy_price <= 1000000000),
  currency text not null default 'USD',
  sector text not null default 'Other',
  notes text,
  created_at timestamptz not null default now(),
  check (shares * buy_price <= 1000000000000),
  check (ticker ~ '^[A-Z0-9][A-Z0-9.:-]{0,24}$'),
  check (length(btrim(name)) between 1 and 100),
  check (currency in ('USD','SGD','MYR','EUR','GBP','JPY','AUD','CAD','HKD'))
);
create index if not exists idx_investments_user on public.investments(user_id);
create index if not exists idx_investments_wallet on public.investments(wallet_id);
alter table public.investments enable row level security;
drop policy if exists "Users can manage their own investments" on public.investments;
create policy "Users can manage their own investments" on public.investments for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (wallet_id is null or exists (
    select 1 from public.wallets w where w.id = investments.wallet_id and w.user_id = (select auth.uid())
  )));
revoke all on public.investments from anon;
grant select, insert, update, delete on public.investments to authenticated;
commit;

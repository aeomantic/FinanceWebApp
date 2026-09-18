-- Goals are savings targets the owner is committed to; wishlist items are
-- wants still being decided on. Both are planning records in the commitments
-- sense: depositing toward a goal only moves the goal's own counter, never a
-- wallet balance or the ledger, so real money movements stay explicit
-- transactions.
--
-- wishlist_items already exists from the init schema (name,
-- target_price_minor, url, notes, status, priority, purchased_transaction_id)
-- so it is altered, not recreated. Amounts are integer minor units and user
-- ownership references profiles(id), per the house rules. Safe to rerun.
begin;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 80),
  target_minor bigint not null check (target_minor > 0 and target_minor <= 9007199254740991),
  saved_minor bigint not null default 0 check (saved_minor >= 0 and saved_minor <= 9007199254740991),
  currency text not null default 'SGD',
  deadline date,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_id_idx on public.goals (user_id);

alter table public.goals enable row level security;
-- Drop whatever policies actually exist before recreating: this project's
-- live policies have repeatedly drifted from the committed files.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'goals' loop
    execute format('drop policy %I on public.goals', p.policyname);
  end loop;
end $$;
create policy goals_select_own on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert_own on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update_own on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete_own on public.goals for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.goals from anon;
grant select, insert, update, delete on public.goals to authenticated;

-- A wish keeps its picker icon, and remembers which goal it became. The FK is
-- ON DELETE SET NULL on purpose: deleting that goal returns the wish to the
-- active list instead of stranding it behind a stale "converted" flag.
alter table public.wishlist_items add column if not exists icon text;
alter table public.wishlist_items add column if not exists converted_goal_id uuid;
alter table public.wishlist_items drop constraint if exists wishlist_items_converted_goal_id_fkey;
alter table public.wishlist_items add constraint wishlist_items_converted_goal_id_fkey
  foreign key (converted_goal_id) references public.goals(id) on delete set null;

-- Refresh wishlist RLS the same defensive way now that the UI depends on it.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'wishlist_items' loop
    execute format('drop policy %I on public.wishlist_items', p.policyname);
  end loop;
end $$;
create policy wishlist_items_select_own on public.wishlist_items for select to authenticated using ((select auth.uid()) = user_id);
create policy wishlist_items_insert_own on public.wishlist_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy wishlist_items_update_own on public.wishlist_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy wishlist_items_delete_own on public.wishlist_items for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.wishlist_items from anon;
grant select, insert, update, delete on public.wishlist_items to authenticated;
commit;

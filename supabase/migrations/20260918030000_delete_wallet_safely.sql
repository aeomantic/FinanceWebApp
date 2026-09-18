-- Definitive wallet-deletion path: a single SECURITY DEFINER RPC that owns the
-- whole delete in one transaction, plus drift-proof foreign keys, so deletion
-- cannot be blocked by RLS on a child table or by a foreign key that drifted to
-- RESTRICT/NO ACTION on the live project.
--
-- BEFORE applying, run this discovery query in the Supabase SQL Editor to see
-- every foreign key that references wallets on the LIVE database (the committed
-- schema only has three; run it to catch any undocumented ones that drifted in):
--
--   select tc.table_name, kcu.column_name, rc.delete_rule
--   from information_schema.table_constraints tc
--   join information_schema.key_column_usage kcu
--     on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
--   join information_schema.referential_constraints rc
--     on tc.constraint_name = rc.constraint_name
--   join information_schema.constraint_column_usage ccu
--     on rc.unique_constraint_name = ccu.constraint_name
--    and rc.unique_constraint_schema = ccu.table_schema
--   where ccu.table_name = 'wallets' and tc.constraint_type = 'FOREIGN KEY';
--
-- Expected rows: transactions.wallet_id (CASCADE),
-- transactions.destination_wallet_id (SET NULL), recurring_rules.wallet_id
-- (SET NULL). If any OTHER row appears, tell Claude and it will extend the
-- function to detach it.
--
-- Safe to rerun.
begin;

-- Drop-by-discovery FK reset: drop whatever FK actually exists on the column
-- (its name may have drifted), then add the canonical one.
create or replace function pg_temp.reset_fk(
  p_table regclass, p_column text, p_constraint text, p_definition text
) returns void language plpgsql as $$
declare con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.conrelid = p_table and a.attname = p_column
  loop
    execute format('alter table %s drop constraint %I', p_table, con.conname);
  end loop;
  execute format('alter table %s add constraint %I %s', p_table, p_constraint, p_definition);
end $$;

select pg_temp.reset_fk('public.transactions', 'wallet_id',
  'transactions_wallet_id_fkey',
  'foreign key (wallet_id) references public.wallets(id) on delete cascade');
select pg_temp.reset_fk('public.transactions', 'destination_wallet_id',
  'transactions_destination_wallet_id_fkey',
  'foreign key (destination_wallet_id) references public.wallets(id) on delete set null');
select pg_temp.reset_fk('public.recurring_rules', 'wallet_id',
  'recurring_rules_wallet_id_fkey',
  'foreign key (wallet_id) references public.wallets(id) on delete set null');
select pg_temp.reset_fk('public.recurring_occurrences', 'transaction_id',
  'recurring_occurrences_transaction_id_fkey',
  'foreign key (transaction_id) references public.transactions(id) on delete set null');
select pg_temp.reset_fk('public.wishlist_items', 'purchased_transaction_id',
  'wishlist_items_purchased_transaction_id_fkey',
  'foreign key (purchased_transaction_id) references public.transactions(id) on delete set null');

-- Recreate the DELETE policies drift-proof (DELETE-cmd only, so other policies
-- survive). The function below runs SECURITY DEFINER and does not depend on
-- these, but keep them correct for any direct delete elsewhere.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'wallets' and cmd = 'DELETE' loop
    execute format('drop policy %I on public.wallets', p.policyname);
  end loop;
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'transactions' and cmd = 'DELETE' loop
    execute format('drop policy %I on public.transactions', p.policyname);
  end loop;
end $$;
create policy wallets_delete_own on public.wallets for delete to authenticated using ((select auth.uid()) = user_id);
create policy transactions_delete_own on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

-- The atomic delete. SECURITY DEFINER so its cleanup statements bypass RLS on
-- every child table (no child DELETE policy can block it), while it enforces
-- ownership itself: caller is auth.uid() (null rejected) and every statement is
-- scoped to user_id = caller. search_path is empty and every name is qualified,
-- which is the safe way to write a definer function.
--
-- Adapted to this schema and NOT the generic template:
--   * recurring_occurrences has no wallet_id column, so it is never deleted by
--     wallet; its link detaches via transaction_id (SET NULL) when the wallet's
--     transactions are deleted.
--   * transfer rows are deleted outright (both directions) rather than having
--     destination_wallet_id nulled, because a transfer with a null destination
--     violates transactions_transfer_wallets_check.
--   * recurring_rules.wallet_id is detached (SET NULL), not deleted, so the
--     commitment plan survives losing its billing wallet.
--   * goals has no wallet_id today; the guarded block only acts if one is ever added.
create or replace function public.delete_wallet_safely(target_wallet_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  wallet_owner uuid;
  was_default boolean;
  remaining_count int;
  new_default_id uuid;
begin
  if caller_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Serialize a caller's wallet mutations so concurrent deletes cannot both
  -- pass the "keep at least one" check or fight over the default flag.
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 20260915));

  select user_id, coalesce(is_default, false) into wallet_owner, was_default
  from public.wallets where id = target_wallet_id;

  if wallet_owner is null then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;
  if wallet_owner <> caller_id then
    raise exception 'Access denied: you do not own this wallet' using errcode = '42501';
  end if;

  select count(*) into remaining_count from public.wallets where user_id = caller_id;
  if remaining_count <= 1 then
    return jsonb_build_object('success', false,
      'error', 'You need at least one wallet. Create another before deleting this one.');
  end if;

  -- Detach commitments billed from this wallet (planning records survive).
  update public.recurring_rules set wallet_id = null
    where user_id = caller_id and wallet_id = target_wallet_id;

  -- Remove every transaction touching the wallet as source or destination, so
  -- no surviving transfer is left with a null destination.
  delete from public.transactions
    where user_id = caller_id
      and (wallet_id = target_wallet_id or destination_wallet_id = target_wallet_id);

  -- Future-proof: only acts if a goals.wallet_id column is ever introduced.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'goals' and column_name = 'wallet_id'
  ) then
    execute 'update public.goals set wallet_id = null where wallet_id = $1 and user_id = $2'
      using target_wallet_id, caller_id;
  end if;

  delete from public.wallets where id = target_wallet_id and user_id = caller_id;

  if was_default then
    select id into new_default_id from public.wallets
      where user_id = caller_id order by created_at asc, id asc limit 1;
    if new_default_id is not null then
      update public.wallets set is_default = true where id = new_default_id;
    end if;
  end if;

  return jsonb_build_object('success', true, 'new_default_id', new_default_id);
end $$;

revoke all on function public.delete_wallet_safely(uuid) from public, anon;
grant execute on function public.delete_wallet_safely(uuid) to authenticated;

drop function pg_temp.reset_fk(regclass, text, text, text);
commit;

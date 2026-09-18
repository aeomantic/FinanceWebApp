-- Wallet deletion is still failing against the live project even after
-- 20260918000000. Because this project's live schema and RLS policies have
-- drifted from the committed files more than once, this migration makes the
-- delete path immune to every remaining failure mode at once, rather than
-- assuming which one is live:
--
--   1. Any foreign key into wallets(id) or transactions(id) that still has NO
--      on-delete action would raise 23503. Every such FK is dropped by
--      discovering whatever constraint actually exists on the column, then
--      recreated with the right action.
--   2. A missing or drifted DELETE policy on wallets/transactions would make
--      the SECURITY INVOKER function silently delete zero rows (or leave a
--      transfer half-detached and trip the transfer check constraint). The
--      DELETE policies are recreated, AND delete_managed_wallet is rebuilt as
--      SECURITY DEFINER so its own deletes never depend on RLS staying correct.
--      It still derives the caller from auth.uid() and filters every statement
--      by user_id, so it can only ever touch the caller's own rows.
--
-- Safe to rerun.
begin;

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

-- Transactions cascade away with their source wallet; a transfer whose
-- destination wallet is deleted is removed explicitly by the function below
-- (SET NULL alone would violate transactions_transfer_wallets_check), but keep
-- SET NULL as the constraint-level fallback.
select pg_temp.reset_fk('public.transactions', 'wallet_id',
  'transactions_wallet_id_fkey',
  'foreign key (wallet_id) references public.wallets(id) on delete cascade');
select pg_temp.reset_fk('public.transactions', 'destination_wallet_id',
  'transactions_destination_wallet_id_fkey',
  'foreign key (destination_wallet_id) references public.wallets(id) on delete set null');

-- A commitment is a planning record; losing its billing wallet should detach
-- it, never delete it (SET NULL, not the task-suggested CASCADE, so the plan
-- survives) and never block the wallet.
select pg_temp.reset_fk('public.recurring_rules', 'wallet_id',
  'recurring_rules_wallet_id_fkey',
  'foreign key (wallet_id) references public.wallets(id) on delete set null');

-- Occurrence and wishlist links to a transaction are history pointers; when
-- the transaction goes, the pointer detaches instead of blocking the delete.
select pg_temp.reset_fk('public.recurring_occurrences', 'transaction_id',
  'recurring_occurrences_transaction_id_fkey',
  'foreign key (transaction_id) references public.transactions(id) on delete set null');
select pg_temp.reset_fk('public.wishlist_items', 'purchased_transaction_id',
  'wishlist_items_purchased_transaction_id_fkey',
  'foreign key (purchased_transaction_id) references public.transactions(id) on delete set null');

-- Recreate the DELETE policies drift-proof: drop whatever DELETE-scoped policy
-- actually exists on each table, then add the canonical one. Only DELETE-cmd
-- policies are touched, so select/insert/update policies are left intact.
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

-- SECURITY DEFINER: the function owns the whole delete, so its internal
-- statements bypass RLS and can never be silently filtered to zero rows by a
-- drifted policy. It stays safe because caller is auth.uid() (null is rejected)
-- and every statement is scoped to user_id = caller. Detaching recurring rules
-- and deleting transactions BEFORE the wallet keeps validate_recurring_commitment
-- and transactions_transfer_wallets_check out of the FK cascade path.
create or replace function public.delete_managed_wallet(p_wallet_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); was_default boolean;
begin
  if caller is null then raise exception 'Sign in to manage wallets' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 20260915));
  perform 1 from public.wallets where user_id = caller order by id for update;
  select is_default into was_default from public.wallets where id = p_wallet_id and user_id = caller;
  if not found then raise exception 'Wallet not found' using errcode = 'P0002'; end if;
  if (select count(*) from public.wallets where user_id = caller) <= 1 then
    raise exception 'Keep at least one wallet' using errcode = '23514';
  end if;
  -- Detach commitments billed from this wallet (planning records survive).
  update public.recurring_rules set wallet_id = null
    where user_id = caller and wallet_id = p_wallet_id;
  -- Remove whole transfer entries first, so a destination FK cannot become
  -- NULL on a surviving transfer and the other wallet receives the right reversal.
  delete from public.transactions where user_id = caller
    and (wallet_id = p_wallet_id or destination_wallet_id = p_wallet_id);
  delete from public.wallets where id = p_wallet_id and user_id = caller;
  if was_default then
    update public.wallets set is_default = true where id = (
      select id from public.wallets where user_id = caller order by created_at, id limit 1
    );
  end if;
end;
$$;
revoke all on function public.delete_managed_wallet(uuid) from public, anon;
grant execute on function public.delete_managed_wallet(uuid) to authenticated;

drop function pg_temp.reset_fk(regclass, text, text, text);
commit;

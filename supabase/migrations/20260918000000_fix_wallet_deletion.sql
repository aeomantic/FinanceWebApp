-- Deleting a wallet has been failing against the live project with the
-- deleteWallet fallback error. The deletion path is delete_managed_wallet():
-- it removes the caller's transactions touching the wallet, then deletes the
-- wallet row. Three referencing objects can block or derail that:
--
--   1. recurring_occurrences.transaction_id and
--      wishlist_items.purchased_transaction_id both reference
--      transactions(id) with NO on-delete action, so any referenced
--      transaction makes the delete raise 23503.
--   2. recurring_rules.wallet_id is meant to be ON DELETE SET NULL, but that
--      referential action fires validate_recurring_commitment mid-cascade,
--      where a raise surfaces as an opaque error on the wallet delete.
--
-- Because this project's live constraints have repeatedly drifted from the
-- committed files, every foreign key below is dropped by discovering whatever
-- constraint actually exists on the column, then recreated canonically.
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
-- destination wallet disappears is removed explicitly by
-- delete_managed_wallet (SET NULL alone would violate the transfer check
-- constraint), but keep SET NULL as the constraint-level fallback.
select pg_temp.reset_fk('public.transactions', 'wallet_id',
  'transactions_wallet_id_fkey',
  'foreign key (wallet_id) references public.wallets(id) on delete cascade');
select pg_temp.reset_fk('public.transactions', 'destination_wallet_id',
  'transactions_destination_wallet_id_fkey',
  'foreign key (destination_wallet_id) references public.wallets(id) on delete set null');

-- A commitment is a planning record; losing its billing wallet should detach
-- it, never delete it and never block the wallet.
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

-- Rebuild delete_managed_wallet to detach recurring rules from the wallet
-- BEFORE deleting it, so validate_recurring_commitment fires in an ordinary
-- update context (its raise messages then reach the client as-is, and the
-- P0001 mapping in deleteWallet can show them) rather than inside the FK's
-- referential action. SECURITY INVOKER retains the caller's RLS throughout.
create or replace function public.delete_managed_wallet(p_wallet_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
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
  -- NULL on a transfer and the surviving wallet receives the correct reversal.
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

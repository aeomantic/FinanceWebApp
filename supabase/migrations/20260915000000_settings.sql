-- Run after the existing wallet and profile migrations. Safe to rerun.
begin;
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists theme_preference text not null default 'system';
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (display_name is null or (length(btrim(display_name)) between 1 and 80));
alter table public.profiles drop constraint if exists profiles_theme_preference_check;
alter table public.profiles add constraint profiles_theme_preference_check
  check (theme_preference in ('light', 'dark', 'system'));
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.wallets, public.categories to authenticated;
grant select, delete on public.transactions to authenticated;

-- Both default changes and deletion use the same per-owner transaction lock.
-- SECURITY INVOKER retains the caller's RLS permissions throughout.
create or replace function public.set_default_wallet(p_wallet_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Sign in to manage wallets' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 20260915));
  perform 1 from public.wallets where user_id = caller order by id for update;
  if not exists (select 1 from public.wallets where id = p_wallet_id and user_id = caller) then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;
  update public.wallets set is_default = false where user_id = caller and is_default;
  update public.wallets set is_default = true where id = p_wallet_id and user_id = caller;
end;
$$;
revoke all on function public.set_default_wallet(uuid) from public, anon;
grant execute on function public.set_default_wallet(uuid) to authenticated;

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
commit;

-- Recurring plans are tracking records. Editing paid_installments does not write
-- a ledger expense or debit a wallet. Existing quarterly/custom schedules survive.
begin;

alter table public.recurring_rules
  add column if not exists obligation_type text not null default 'subscription',
  add column if not exists total_installments integer,
  add column if not exists paid_installments integer not null default 0,
  add column if not exists end_date date,
  add column if not exists billing_cycle text,
  add column if not exists icon text not null default 'rotate-ccw',
  add column if not exists wallet_id uuid,
  add column if not exists updated_at timestamptz not null default now();

-- Do not label quarterly/custom-month plans as monthly.
update public.recurring_rules set billing_cycle = frequency
where billing_cycle is null and frequency in ('weekly', 'monthly', 'yearly');

alter table public.recurring_rules drop constraint if exists recurring_rules_wallet_id_fkey;
alter table public.recurring_rules add constraint recurring_rules_wallet_id_fkey
  foreign key (wallet_id) references public.wallets(id) on delete set null;
alter table public.recurring_rules drop constraint if exists recurring_rules_category_id_fkey;
alter table public.recurring_rules add constraint recurring_rules_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete set null;

-- NOT VALID avoids rewriting or rejecting unrelated legacy records. Every new
-- insert/update is checked; existing rows retain their original schedule fields.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.recurring_rules'::regclass and conname = 'recurring_rules_obligation_check') then
    alter table public.recurring_rules add constraint recurring_rules_obligation_check check (
      obligation_type in ('subscription', 'bnpl') and
      (billing_cycle is null or billing_cycle in ('weekly', 'monthly', 'yearly')) and
      paid_installments >= 0 and
      (obligation_type <> 'bnpl' or
       (total_installments between 1 and 600 and paid_installments <= total_installments and end_date is not null))
    ) not valid;
  end if;
end $$;

create or replace function public.validate_recurring_commitment()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  remaining integer;
  months_per_cycle integer;
  last_due date;
  month_start date;
begin
  if TG_OP = 'UPDATE' and (new.id <> old.id or new.user_id <> old.user_id) then
    raise exception 'Commitment ownership cannot change' using errcode = '23514';
  end if;
  if new.wallet_id is not null and not exists (
    select 1 from public.wallets w where w.id = new.wallet_id and w.user_id = new.user_id and w.currency = new.currency
  ) then raise exception 'Choose an owned wallet in the commitment currency' using errcode = '23514'; end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id and c.type = 'expense'
  ) then raise exception 'Choose an owned expense category' using errcode = '23514'; end if;
  if new.amount_minor <= 0 or new.amount_minor > 9007199254740991 or new.interval_count not between 1 and 120 then
    raise exception 'Invalid commitment amount or interval' using errcode = '23514';
  end if;
  if new.obligation_type = 'bnpl' then
    if new.total_installments is null or new.total_installments not between 1 and 600 or
       new.paid_installments is null or new.paid_installments not between 0 and new.total_installments or new.end_date is null then
      raise exception 'Invalid installment details' using errcode = '23514';
    end if;
    if new.amount_minor::numeric * new.total_installments > 9007199254740991 then
      raise exception 'Commitment total exceeds supported amount' using errcode = '23514';
    end if;
    remaining := new.total_installments - new.paid_installments;
    if remaining > 0 then
      if new.frequency = 'weekly' then
        last_due := new.next_due_on + 7 * (remaining - 1);
      else
        months_per_cycle := case new.frequency when 'yearly' then 12 when 'quarterly' then 3 when 'custom_months' then new.interval_count else 1 end;
        month_start := (date_trunc('month', new.next_due_on) + make_interval(months => months_per_cycle * (remaining - 1)))::date;
        last_due := month_start + least(extract(day from new.next_due_on)::integer, extract(day from (month_start + interval '1 month - 1 day'))::integer) - 1;
      end if;
      if last_due > new.end_date then raise exception 'Deadline is before the final scheduled installment' using errcode = '23514'; end if;
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function public.validate_recurring_commitment() from public, anon, authenticated;
drop trigger if exists recurring_commitment_validation on public.recurring_rules;
create trigger recurring_commitment_validation before insert or update on public.recurring_rules
for each row execute function public.validate_recurring_commitment();

alter table public.recurring_rules enable row level security;
-- Remove permissive old variants because PostgreSQL ORs permissive policies.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'recurring_rules' loop
    execute format('drop policy %I on public.recurring_rules', p.policyname);
  end loop;
end $$;
create policy recurring_rules_select_own on public.recurring_rules for select to authenticated using ((select auth.uid()) = user_id);
create policy recurring_rules_insert_own on public.recurring_rules for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (wallet_id is null or exists (select 1 from public.wallets w where w.id = recurring_rules.wallet_id and w.user_id = (select auth.uid())))
  and (category_id is null or exists (select 1 from public.categories c where c.id = recurring_rules.category_id and c.user_id = (select auth.uid()) and c.type = 'expense'))
);
create policy recurring_rules_update_own on public.recurring_rules for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and (wallet_id is null or exists (select 1 from public.wallets w where w.id = recurring_rules.wallet_id and w.user_id = (select auth.uid())))
  and (category_id is null or exists (select 1 from public.categories c where c.id = recurring_rules.category_id and c.user_id = (select auth.uid()) and c.type = 'expense'))
);
create policy recurring_rules_delete_own on public.recurring_rules for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.recurring_rules from anon;
grant select, insert, update, delete on public.recurring_rules to authenticated;
create index if not exists recurring_rules_wallet_id_idx on public.recurring_rules(wallet_id);
commit;

begin;
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  wallet_id uuid references public.wallets(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  biller_name text not null check (length(trim(biller_name)) between 1 and 120),
  amount numeric not null check (amount > 0 and amount * 100 = trunc(amount * 100) and amount * 100 <= 9007199254740991),
  due_day integer not null check (due_day between 1 and 31),
  frequency text not null default 'monthly' check (frequency in ('monthly','quarterly','yearly')),
  auto_pay boolean not null default false,
  notes text,
  last_paid_date date,
  next_due_date date not null,
  created_at timestamptz not null default now(),
  currency text not null default 'SGD',
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists idx_bills_user_due on public.bills(user_id, next_due_date);
alter table public.bills enable row level security;
drop policy if exists "Users can manage own bills" on public.bills;
create policy "Users can manage own bills" on public.bills for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.validate_bill() returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.wallet_id is not null and not exists(select 1 from public.wallets where id = new.wallet_id and user_id = new.user_id and currency = new.currency) then
    raise exception 'Choose an owned wallet with matching currency' using errcode = '23514';
  end if;
  if new.category_id is not null and not exists(select 1 from public.categories where id = new.category_id and user_id = new.user_id and type = 'expense') then
    raise exception 'Choose an owned expense category' using errcode = '23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists validate_bill on public.bills;
create trigger validate_bill before insert or update on public.bills for each row execute function public.validate_bill();

create or replace function public.mark_bill_paid(p_id uuid, p_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.bills%rowtype; transaction_id uuid; month_start date;
begin
  select * into b from public.bills where id = p_id and user_id = auth.uid() for update;
  if not found or b.updated_at is distinct from p_updated_at then
    raise exception 'Bill changed or already paid; refresh first' using errcode = 'P0002';
  end if;
  perform 1 from public.wallets where id = b.wallet_id and user_id = auth.uid() and currency = b.currency for update;
  if not found then raise exception 'Assign an owned wallet' using errcode = '23514'; end if;
  insert into public.transactions(user_id,wallet_id,category_id,amount_minor,currency,type,occurred_on,note)
  values(auth.uid(),b.wallet_id,b.category_id,(b.amount * 100)::bigint,b.currency,'expense',current_date,'Bill: ' || b.biller_name)
  returning id into transaction_id;
  -- The ledger INSERT trigger debits the wallet; never debit it a second time.
  month_start := (date_trunc('month',b.next_due_date) + make_interval(months => case b.frequency when 'yearly' then 12 when 'quarterly' then 3 else 1 end))::date;
  update public.bills set last_paid_date = current_date,
    next_due_date = month_start + least(b.due_day,extract(day from month_start + interval '1 month - 1 day')::integer) - 1
    where id = b.id and user_id = auth.uid();
  if not found then raise exception 'Bill update denied' using errcode = '42501'; end if;
  return transaction_id;
end $$;
revoke all on function public.mark_bill_paid(uuid,timestamptz) from public, anon;
grant execute on function public.mark_bill_paid(uuid,timestamptz) to authenticated;
grant select,insert,update,delete on public.bills to authenticated;
commit;

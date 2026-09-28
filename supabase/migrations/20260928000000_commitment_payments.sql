begin;

-- Existing ledger triggers use unqualified relations. Pin their resolution,
-- including when invoked from functions with a restricted search_path.
alter function public.sync_wallet_balance() set search_path = public, pg_temp;

-- Large selections travel in a request body instead of a PostgREST URL.
create or replace function public.delete_transactions(p_ids uuid[])
returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare deleted integer;
begin
  if auth.uid() is null or coalesce(cardinality(p_ids), 0) not between 1 and 10000 then
    raise exception 'Invalid transaction selection' using errcode = '22023';
  end if;
  delete from public.transactions where user_id = auth.uid() and id = any(p_ids);
  get diagnostics deleted = row_count;
  return deleted;
end $$;
revoke all on function public.delete_transactions(uuid[]) from public, anon;
grant execute on function public.delete_transactions(uuid[]) to authenticated;

create or replace function public.mark_commitment_paid(p_id uuid, p_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  r public.recurring_rules%rowtype;
  category uuid;
  transaction_id uuid;
  next_date date;
  months integer;
  month_start date;
  completed boolean;
begin
  -- Serializes concurrent clicks. The version prevents a retry from paying
  -- the next cycle after the first request committed but its response was lost.
  select * into r from public.recurring_rules
    where id = p_id and user_id = auth.uid() for update;
  if not found or r.updated_at is distinct from p_updated_at or not r.is_active
    or (r.obligation_type = 'bnpl' and r.paid_installments >= r.total_installments) then
    raise exception 'Commitment changed or already completed' using errcode = 'P0002';
  end if;
  perform 1 from public.wallets where id = r.wallet_id and user_id = auth.uid() and currency = r.currency for update;
  if not found then raise exception 'Choose an owned wallet' using errcode = '23514'; end if;

  category := r.category_id;
  if category is null then
    select id into category from public.categories
      where user_id = auth.uid() and type = 'expense' and not is_archived
      and lower(name) in ('bills', 'utilities', 'bills/utilities', 'bills & utilities')
      order by name, id limit 1;
    if category is null then
      insert into public.categories(user_id, name, type) values(auth.uid(), 'Bills/Utilities', 'expense') returning id into category;
    end if;
  end if;

  insert into public.transactions(user_id, wallet_id, category_id, amount_minor, currency, type, occurred_on, note)
    values(auth.uid(), r.wallet_id, category, r.amount_minor, r.currency, 'expense', (now() at time zone 'UTC')::date,
      case when r.obligation_type = 'bnpl' then
        format('Installment %s of %s: %s', r.paid_installments + 1, r.total_installments, r.name)
      else 'Subscription: ' || r.name end)
    returning id into transaction_id;
  -- INSERT's existing trigger debits the wallet exactly once.
  completed := r.obligation_type = 'bnpl' and r.paid_installments + 1 >= r.total_installments;
  if r.frequency = 'weekly' then
    next_date := r.next_due_on + 7;
  else
    months := case r.frequency when 'yearly' then 12 when 'quarterly' then 3 when 'custom_months' then r.interval_count else 1 end;
    month_start := (date_trunc('month', r.next_due_on) + make_interval(months => months))::date;
    -- Clamp month ends (Jan 31 -> Feb 28) without drifting the original day.
    next_date := month_start + least(extract(day from r.anchor_date)::integer,
      extract(day from (month_start + interval '1 month - 1 day'))::integer) - 1;
  end if;
  update public.recurring_rules set
    paid_installments = case when r.obligation_type = 'bnpl' then r.paid_installments + 1 else r.paid_installments end,
    is_active = not completed,
    next_due_on = case when completed then r.next_due_on else next_date end
    where id = r.id and user_id = auth.uid();
  if not found then raise exception 'Commitment update denied' using errcode = '42501'; end if;
  return transaction_id;
end $$;

revoke all on function public.mark_commitment_paid(uuid, timestamptz) from public, anon;
grant execute on function public.mark_commitment_paid(uuid, timestamptz) to authenticated;
commit;

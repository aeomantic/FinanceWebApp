-- Run against a local test database with migrations applied, as postgres.
-- All fixtures and changes roll back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
insert into public.profiles(id,email) values ('10000000-0000-4000-8000-000000000001','ledger-test@example.com'), ('10000000-0000-4000-8000-000000000002','other-test@example.com');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare
  a uuid; b uuid; rule uuid; tx uuid; version timestamptz; before_balance bigint; before_count bigint;
  due date; frequency_value text; expected date;
begin
  insert into public.wallets(user_id,name,balance_minor) values(auth.uid(),'A',10000) returning id into a;
  insert into public.wallets(user_id,name,balance_minor) values(auth.uid(),'B',5000) returning id into b;
  insert into public.transactions(user_id,wallet_id,type,amount_minor,occurred_on) values
    (auth.uid(),a,'expense',1200,current_date), (auth.uid(),a,'income',3000,current_date),
    (auth.uid(),b,'expense',700,current_date);
  insert into public.transactions(user_id,wallet_id,destination_wallet_id,type,amount_minor,occurred_on)
    values(auth.uid(),a,b,'transfer',2000,current_date);
  assert (select balance_minor from public.wallets where id=a) = 9800, 'insert balance A';
  assert (select balance_minor from public.wallets where id=b) = 6300, 'insert balance B';
  delete from public.transactions where user_id=auth.uid() and wallet_id in (a,b);
  assert (select balance_minor from public.wallets where id=a) = 10000, 'batch reversal A';
  assert (select balance_minor from public.wallets where id=b) = 5000, 'batch reversal B';
  delete from public.transactions where user_id=auth.uid() and wallet_id in (a,b);
  assert (select balance_minor from public.wallets where id=a) = 10000, 'retry must not reverse twice';

  insert into public.transactions(user_id,wallet_id,type,amount_minor,occurred_on)
    select auth.uid(),a,'expense',10,current_date from generate_series(1,150);
  assert public.delete_transactions(array(select id from public.transactions where user_id=auth.uid()))=150, 'large batch count';
  assert (select balance_minor from public.wallets where id=a) = 10000, 'large batch reversal';

  insert into public.recurring_rules(user_id,name,wallet_id,amount_minor,frequency,anchor_date,next_due_on,obligation_type,total_installments,paid_installments,end_date)
    values(auth.uid(),'Final BNPL',a,2500,'monthly','2026-09-28','2026-09-28','bnpl',3,2,'2026-09-28') returning id,updated_at into rule,version;
  tx := public.mark_commitment_paid(rule,version);
  assert (select balance_minor from public.wallets where id=a) = 7500, 'final expense deducted once';
  assert (select paid_installments=3 and not is_active from public.recurring_rules where id=rule), 'final installment completed';
  assert (select note='Installment 3 of 3: Final BNPL' and amount_minor=2500 and type='expense' and category_id is not null from public.transactions where id=tx), 'final expense and fallback category';
  begin
    perform public.mark_commitment_paid(rule,version);
    raise exception 'duplicate payment was accepted';
  exception when no_data_found then null;
  end;
  assert (select balance_minor from public.wallets where id=a) = 7500, 'duplicate click cannot debit';
  delete from public.transactions where id=tx;
  assert (select balance_minor from public.wallets where id=a) = 10000, 'single deletion restores funds';

  foreach frequency_value in array array['weekly','monthly','yearly','quarterly','custom_months'] loop
    due := '2024-01-31';
    expected := case frequency_value when 'weekly' then '2024-02-07'::date when 'monthly' then '2024-02-29'::date
      when 'yearly' then '2025-01-31'::date when 'quarterly' then '2024-04-30'::date else '2024-03-31'::date end;
    insert into public.recurring_rules(user_id,name,wallet_id,amount_minor,frequency,interval_count,anchor_date,next_due_on)
      values(auth.uid(),frequency_value,a,100,frequency_value,2,due,due) returning id,updated_at into rule,version;
    perform public.mark_commitment_paid(rule,version);
    assert (select next_due_on=expected from public.recurring_rules where id=rule), 'schedule advancement';
    begin
      perform public.mark_commitment_paid(rule,version);
      raise exception 'stale subscription click was accepted';
    exception when no_data_found then null;
    end;
  end loop;

  -- Force schedule validation to fail AFTER the expense INSERT. The entire
  -- RPC must roll back the expense, debit, and paid count.
  insert into public.recurring_rules(user_id,name,wallet_id,amount_minor,frequency,anchor_date,next_due_on,obligation_type,total_installments,paid_installments,end_date)
    values(auth.uid(),'Rollback',a,500,'monthly','2026-01-31','2026-02-28','bnpl',2,0,'2026-03-28') returning id,updated_at into rule,version;
  select balance_minor into before_balance from public.wallets where id=a;
  select count(*) into before_count from public.transactions where user_id=auth.uid();
  begin
    perform public.mark_commitment_paid(rule,version);
    raise exception 'expected schedule failure';
  exception when check_violation then null;
  end;
  assert (select balance_minor from public.wallets where id=a)=before_balance, 'failed payment balance rollback';
  assert (select count(*) from public.transactions where user_id=auth.uid())=before_count, 'failed payment expense rollback';
  assert (select paid_installments from public.recurring_rules where id=rule)=0, 'failed payment progress rollback';

  -- The second owner cannot see or mutate the first owner's records.
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
  delete from public.transactions where wallet_id=a;
  assert not exists(select 1 from public.wallets where id=a), 'wallet RLS';
  begin
    perform public.mark_commitment_paid(rule,version);
    raise exception 'cross-owner payment was accepted';
  exception when no_data_found then null;
  end;
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
  assert (select count(*) from public.transactions where user_id=auth.uid())=before_count, 'cross-owner delete blocked';
end $$;
rollback;
\echo 'PASS: mixed batch/single deletion, final BNPL, schedules, stale clicks, rollback, ownership'

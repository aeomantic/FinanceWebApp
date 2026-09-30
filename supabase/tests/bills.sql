-- Run locally after migrations. Fixtures roll back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('20000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002');
insert into public.profiles(id,email) values ('20000000-0000-4000-8000-000000000001','bills-test@example.com'),('20000000-0000-4000-8000-000000000002','other-bills@example.com');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare w uuid; b uuid; t uuid; v timestamptz; total_before numeric; f text; expected date;
begin
  insert into public.wallets(user_id,name,currency,balance_minor) values(auth.uid(),'Bills test','SGD',10000) returning id into w;
  insert into public.bills(biller_name,amount,due_day,wallet_id,next_due_date) values('Electricity',12.34,30,w,current_date) returning id,updated_at into b,v;
  t := public.mark_bill_paid(b,v);
  assert (select balance_minor from public.wallets where id=w)=8766, 'wallet debited once';
  assert (select amount_minor=1234 and type='expense' and note='Bill: Electricity' from public.transactions where id=t), 'expense logged';
  assert (select last_paid_date=current_date and date_trunc('month',next_due_date)=date_trunc('month',current_date)+interval '1 month' from public.bills where id=b), 'pending moved out of current month';
  begin
    perform public.mark_bill_paid(b,v);
    raise exception 'duplicate payment accepted';
  exception when no_data_found then null; end;
  assert (select balance_minor from public.wallets where id=w)=8766, 'retry cannot debit next cycle';
  foreach f in array array['monthly','quarterly','yearly'] loop
    expected := case f when 'monthly' then '2024-02-29'::date when 'quarterly' then '2024-04-30'::date else '2025-01-31'::date end;
    update public.bills set next_due_date='2024-01-31',due_day=31,frequency=f where id=b returning updated_at into v;
    perform public.mark_bill_paid(b,v);
    assert (select next_due_date from public.bills where id=b)=expected, 'month-end advance';
  end loop;
  update public.bills set wallet_id=null where id=b returning updated_at into v;
  select count(*) into total_before from public.transactions;
  begin
    perform public.mark_bill_paid(b,v);
    raise exception 'missing wallet accepted';
  exception when check_violation then null; end;
  assert (select count(*) from public.transactions)=total_before, 'failed payment leaves no expense';
  perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
  assert (select count(*) from public.bills)=0, 'RLS hides another user bills';
  begin
    perform public.mark_bill_paid(b,v);
    raise exception 'cross-user payment accepted';
  exception when no_data_found then null; end;
end $$;
rollback;

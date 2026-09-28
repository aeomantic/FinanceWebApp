\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('20000000-0000-4000-8000-000000000001'), ('20000000-0000-4000-8000-000000000002');
insert into public.profiles(id,email) values ('20000000-0000-4000-8000-000000000001','investor@example.com'), ('20000000-0000-4000-8000-000000000002','other-investor@example.com');
insert into public.wallets(id,user_id,name,balance_minor) values
  ('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','Owned',10000),
  ('20000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000002','Other',20000);
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare holding uuid;
begin
  insert into public.investments(ticker,name,shares,buy_price,wallet_id) values('AAPL','Apple',10.5,150.25,'20000000-0000-4000-8000-000000000011') returning id into holding;
  assert (select shares*buy_price from public.investments where id=holding)=1577.625, 'decimal precision';
  assert (select balance_minor from public.wallets where id='20000000-0000-4000-8000-000000000011')=10000, 'tracking does not debit cash';
  begin
    update public.investments set wallet_id='20000000-0000-4000-8000-000000000012' where id=holding;
    raise exception 'foreign wallet accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.investments set shares=0 where id=holding;
    raise exception 'zero shares accepted';
  exception when check_violation then null;
  end;
  update public.investments set shares=2.75,buy_price=0 where id=holding;
  assert (select shares from public.investments where id=holding)=2.75, 'edit holding';
  perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
  assert not exists(select 1 from public.investments where id=holding), 'cross-owner read';
  delete from public.investments where id=holding;
  perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
  assert exists(select 1 from public.investments where id=holding), 'cross-owner delete';
  delete from public.wallets where id='20000000-0000-4000-8000-000000000011';
  assert (select wallet_id is null from public.investments where id=holding), 'wallet deletion detaches holding';
  delete from public.investments where id=holding;
  assert not exists(select 1 from public.investments where id=holding), 'owner delete';
end $$;
rollback;
\echo 'PASS: investment decimals, edits, deletion, wallet ownership, RLS, cash isolation'

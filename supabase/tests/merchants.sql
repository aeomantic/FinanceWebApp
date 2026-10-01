-- Local regression fixture only. Synthetic rows are rolled back.
begin;
insert into auth.users(id,email) values
 ('31000000-0000-4000-8000-000000000001','merchant-owner@example.test'),
 ('31000000-0000-4000-8000-000000000002','merchant-other@example.test');
insert into public.categories(id,user_id,name,type) values
 ('32000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Groceries','expense'),
 ('32000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002','Food','expense');
insert into public.wallets(id,user_id,name) values
 ('33000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Cash');
insert into public.merchants(id,user_id,name,category_id) values
 ('34000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002','Private shop','32000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
insert into public.merchants(id,user_id,name,category_id) values
 ('34000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Kallang Minimart','32000000-0000-4000-8000-000000000001');
do $$ declare affected integer; begin
 if (select count(*) from public.merchants where user_id is null) <> 21 then raise exception 'Presets missing or duplicated'; end if;
 if exists(select 1 from public.merchants where name='Private shop') then raise exception 'Private merchant leaked'; end if;
 update public.merchants set name='Hijacked' where user_id is null or user_id <> auth.uid();
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Foreign/system update allowed'; end if;
 delete from public.merchants where user_id is null or user_id <> auth.uid();
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Foreign/system delete allowed'; end if;
 begin
  insert into public.merchants(user_id,name) values(null,'Fake preset');
  raise exception 'Preset insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.merchants(user_id,name,category_id) values(auth.uid(),'Stolen category','32000000-0000-4000-8000-000000000002');
  raise exception 'Foreign category allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.merchants(user_id,name) values(auth.uid(),' kallang minimart ');
  raise exception 'Duplicate merchant allowed';
 exception when unique_violation then null; end;
 begin
  update public.merchants set user_id=null where name='Kallang Minimart';
  raise exception 'Owner escalation allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.transactions(user_id,wallet_id,amount_minor,currency,type,occurred_on,merchant_id)
  values(auth.uid(),'33000000-0000-4000-8000-000000000001',100,'SGD','expense','2026-10-02','34000000-0000-4000-8000-000000000002');
  raise exception 'Foreign merchant assignment allowed';
 exception when insufficient_privilege then null; end;
end $$;
insert into public.transactions(id,user_id,wallet_id,amount_minor,currency,type,occurred_on,merchant_id)
values('35000000-0000-4000-8000-000000000001',auth.uid(),'33000000-0000-4000-8000-000000000001',100,'SGD','expense','2026-10-02','34000000-0000-4000-8000-000000000001');
update public.transactions set merchant_id=(select id from public.merchants where name='NTUC FairPrice' and user_id is null)
where id='35000000-0000-4000-8000-000000000001';
do $$ begin
 begin
  update public.transactions set merchant_id='34000000-0000-4000-8000-000000000002' where id='35000000-0000-4000-8000-000000000001';
  raise exception 'Foreign merchant edit allowed';
 exception when insufficient_privilege then null; end;
end $$;
update public.transactions set merchant_id='34000000-0000-4000-8000-000000000001' where id='35000000-0000-4000-8000-000000000001';
delete from public.merchants where id='34000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.transactions where merchant_id is not null and id='35000000-0000-4000-8000-000000000001') then raise exception 'Delete failed to detach merchant'; end if;
 if (select balance_minor from public.wallets where id='33000000-0000-4000-8000-000000000001') <> -100 then raise exception 'Merchant edits changed balance'; end if;
 raise notice 'PASS: presets, personal CRUD, cross-user isolation, insert/update ownership, duplicate normalization, FK deletion and unchanged balances';
end $$;
rollback;

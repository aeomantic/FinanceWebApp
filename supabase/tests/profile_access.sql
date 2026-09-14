-- Run with psql against a LOCAL test database with the migrations already applied.
-- All synthetic accounts and profile changes below are rolled back.
\set ON_ERROR_STOP on
begin;

-- Auth inserts run without an end-user JWT. The trigger must still create profiles.
set local role supabase_auth_admin;
insert into auth.users (id, email) values
('20000000-0000-4000-8000-000000000001', 'profile-owner@example.test'),
('20000000-0000-4000-8000-000000000002', 'profile-other@example.test'),
('20000000-0000-4000-8000-000000000003', null);
reset role;

do $$ begin
  if (select count(*) from public.profiles where id in (
    '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'
  )) <> 2 then raise exception 'Auth trigger did not create email profiles without a JWT'; end if;
  if exists (select 1 from public.profiles where id = '20000000-0000-4000-8000-000000000003') then
    raise exception 'Null-email account should not create a profile in this email-only app';
  end if;
  if has_function_privilege('authenticated', 'public.create_auth_user_profile()', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_auth_user_profile()', 'EXECUTE') then
    raise exception 'Trigger function is executable by a client role';
  end if;
  raise notice 'PASS: trigger without JWT, email-only guard, function access';
end $$;

-- Exercise INSERT rather than relying only on the trigger's privileged insert.
delete from public.profiles where id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
insert into public.profiles (id, email) values
('20000000-0000-4000-8000-000000000001', 'profile-owner@example.test');
update public.profiles set email = 'updated-owner@example.test'
where id = '20000000-0000-4000-8000-000000000001';

do $$ declare changed integer; begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Caller can see other profiles'; end if;
  if not exists (select 1 from public.profiles where email = 'updated-owner@example.test') then raise exception 'Own update failed'; end if;
  update public.profiles set email = 'forbidden@example.test' where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user update allowed'; end if;
  begin
    insert into public.profiles (id, email) values ('20000000-0000-4000-8000-000000000002', 'forbidden@example.test');
    raise exception 'Cross-user insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set id = '20000000-0000-4000-8000-000000000003'
    where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'Profile ownership change allowed';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: own SELECT/INSERT/UPDATE, cross-user access blocked, ownership change blocked';
end $$;

-- An authenticated role without a user claim must not gain row access.
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if exists (select 1 from public.profiles) then raise exception 'Missing JWT claim can read profiles'; end if;
  begin
    insert into public.profiles (id, email) values ('20000000-0000-4000-8000-000000000003', 'forbidden@example.test');
    raise exception 'Missing JWT claim can insert a profile';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: missing user claim denied';
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    if exists (select 1 from public.profiles) then raise exception 'Anonymous read allowed'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id, email) values ('20000000-0000-4000-8000-000000000003', 'forbidden@example.test');
    raise exception 'Anonymous insert allowed';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: anonymous reads and writes denied';
end $$;
reset role;
rollback;

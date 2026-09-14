-- Read-only: run in the hosted project's SQL Editor to diagnose profile writes.
select
  has_schema_privilege('authenticated', 'public', 'USAGE') as schema_access,
  has_table_privilege('authenticated', 'public.profiles', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'public.profiles', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as can_update,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'profiles';

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;

select t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definition,
  p.prosecdef as security_definer, p.proconfig as function_settings,
  pg_get_userbyid(p.proowner) as function_owner
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass
  and t.tgname = 'on_auth_user_created'
  and not t.tgisinternal;

select count(*) as email_accounts_missing_profiles
from auth.users u
left join public.profiles p on p.id = u.id
where u.email is not null and p.id is null;

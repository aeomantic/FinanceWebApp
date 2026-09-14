-- Profile access and provisioning for email/password Supabase Auth.
-- Run as postgres in the Supabase SQL Editor, after the initial schema.
-- Passwords stay in auth.users. No password or metadata columns are added here.
begin;

alter table public.profiles enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;

-- Replace the policies used by this app and the names in the manual repair.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Auth creates users before a browser session exists. The trigger performs
-- this one trusted insert as postgres, independently of the caller's JWT.
create or replace function public.create_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- This app supports email accounts; profiles.email is NOT NULL.
  if new.email is not null then
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

alter function public.create_auth_user_profile() owner to postgres;
revoke all on function public.create_auth_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_auth_user_profile();

-- A new-user trigger alone would not repair accounts that already exist.
-- Preserve existing profile rows and create only those that are missing.
insert into public.profiles (id, email)
select id, email
from auth.users
where email is not null
on conflict (id) do nothing;

commit;

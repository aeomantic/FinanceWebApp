-- Category creation was failing from the app with a generic error. Diagnosed
-- by reproducing the exact insert with the service role key (bypasses RLS):
-- it succeeded, so the schema and payload are fine. The block is RLS on
-- categories, specifically for authenticated (non-service-role) requests.
--
-- Same root cause as the transactions policy fix: this project's live RLS
-- policies were not created by running the original migration files, so
-- their real names and definitions cannot be assumed. Normalizes all four
-- categories policies to a known-good state rather than guessing which one
-- is missing or misconfigured.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'categories'
  loop
    execute format('drop policy %I on categories', pol.policyname);
  end loop;
end $$;

create policy "categories_select_own" on categories
  for select using (user_id = auth.uid());

create policy "categories_insert_own" on categories
  for insert with check (user_id = auth.uid());

create policy "categories_update_own" on categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories_delete_own" on categories
  for delete using (user_id = auth.uid());

-- Transactions were being written successfully (wallet balances updated
-- correctly via the trigger) but never appeared in the dashboard's
-- transaction feed. Confirmed via service-role query that the rows exist,
-- which isolates this to RLS: the wallets migration normalized INSERT and
-- UPDATE policies on transactions but never touched SELECT or DELETE,
-- leaving whatever the live database's actual (differently-named,
-- apparently non-functional) SELECT policy was still in place.
--
-- Normalizes all four transactions policies this time, not just the two
-- that were visibly broken, so this doesn't recur a third time.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'transactions'
  loop
    execute format('drop policy %I on transactions', pol.policyname);
  end loop;
end $$;

create policy "transactions_select_own" on transactions
  for select using (user_id = auth.uid());

create policy "transactions_insert_own" on transactions
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from wallets w where w.id = wallet_id and w.user_id = auth.uid())
    and (destination_wallet_id is null or exists (
      select 1 from wallets w2 where w2.id = destination_wallet_id and w2.user_id = auth.uid()
    ))
    and (category_id is null or exists (
      select 1 from categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

create policy "transactions_update_own" on transactions
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from wallets w where w.id = wallet_id and w.user_id = auth.uid())
    and (destination_wallet_id is null or exists (
      select 1 from wallets w2 where w2.id = destination_wallet_id and w2.user_id = auth.uid()
    ))
    and (category_id is null or exists (
      select 1 from categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

create policy "transactions_delete_own" on transactions
  for delete using (user_id = auth.uid());

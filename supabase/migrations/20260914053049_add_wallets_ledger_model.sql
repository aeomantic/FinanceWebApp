-- Pivots the ledger from bare category-tagged transactions to a wallet
-- (envelope) model: every transaction moves money into, out of, or between
-- wallets. No real transaction data exists yet (verified before writing
-- this migration), so tables are altered in place rather than migrated.

create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  currency text not null default 'SGD',
  balance_minor bigint not null default 0,
  color text,
  created_at timestamptz not null default now()
);

create index wallets_user_id_idx on wallets (user_id);

alter table wallets enable row level security;

create policy "wallets_select_own" on wallets
  for select using (user_id = auth.uid());

create policy "wallets_insert_own" on wallets
  for insert with check (user_id = auth.uid());

create policy "wallets_update_own" on wallets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wallets_delete_own" on wallets
  for delete using (user_id = auth.uid());

-- categories: narrow to expense/income (transfers are now a transaction
-- type on the ledger, not a category), add an icon for the picker UI.
alter table categories rename column kind to type;
alter table categories drop constraint categories_kind_check;
alter table categories add constraint categories_type_check check (type in ('expense', 'income'));
alter table categories add column icon text;

-- transactions: add wallet_id (required) and destination_wallet_id (only
-- for transfers), allow the 'transfer' type, replace amount_minor's
-- implicit sign convention with an explicit positive-magnitude check, and
-- collapse merchant/notes into a single optional note field.
alter table transactions add column wallet_id uuid references wallets(id) on delete cascade;
alter table transactions add column destination_wallet_id uuid references wallets(id) on delete set null;
alter table transactions rename column notes to note;
alter table transactions drop column merchant;

alter table transactions drop constraint transactions_category_id_fkey;
alter table transactions add constraint transactions_category_id_fkey
  foreign key (category_id) references categories(id) on delete set null;

alter table transactions drop constraint transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('expense', 'income', 'transfer'));

alter table transactions add constraint transactions_amount_minor_check check (amount_minor > 0);
alter table transactions add constraint transactions_transfer_wallets_check check (
  (type = 'transfer' and destination_wallet_id is not null and destination_wallet_id <> wallet_id)
  or (type <> 'transfer' and destination_wallet_id is null)
);

-- Now that every existing (zero) row would need one, make wallet_id required.
alter table transactions alter column wallet_id set not null;

create index transactions_wallet_id_idx on transactions (wallet_id);
create index transactions_destination_wallet_id_idx on transactions (destination_wallet_id);

-- Replace the transactions write policies with ones that also confirm the
-- referenced wallet(s) and category belong to the same user. Without this,
-- a request that passes user_id = auth.uid() could still point wallet_id
-- at someone else's wallet and mutate its balance through the trigger below.
drop policy "transactions_insert_own" on transactions;
drop policy "transactions_update_own" on transactions;

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

-- Keep wallet balances correct regardless of how a transaction row is
-- written, by deriving them from the ledger instead of trusting the client
-- to also patch the wallet balance in a second request.
create or replace function sync_wallet_balance()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if new.type = 'expense' then
      update wallets set balance_minor = balance_minor - new.amount_minor where id = new.wallet_id;
    elsif new.type = 'income' then
      update wallets set balance_minor = balance_minor + new.amount_minor where id = new.wallet_id;
    elsif new.type = 'transfer' then
      update wallets set balance_minor = balance_minor - new.amount_minor where id = new.wallet_id;
      update wallets set balance_minor = balance_minor + new.amount_minor where id = new.destination_wallet_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.type = 'expense' then
      update wallets set balance_minor = balance_minor + old.amount_minor where id = old.wallet_id;
    elsif old.type = 'income' then
      update wallets set balance_minor = balance_minor - old.amount_minor where id = old.wallet_id;
    elsif old.type = 'transfer' then
      update wallets set balance_minor = balance_minor + old.amount_minor where id = old.wallet_id;
      update wallets set balance_minor = balance_minor - old.amount_minor where id = old.destination_wallet_id;
    end if;
    return old;
  elsif TG_OP = 'UPDATE' then
    if old.type = 'expense' then
      update wallets set balance_minor = balance_minor + old.amount_minor where id = old.wallet_id;
    elsif old.type = 'income' then
      update wallets set balance_minor = balance_minor - old.amount_minor where id = old.wallet_id;
    elsif old.type = 'transfer' then
      update wallets set balance_minor = balance_minor + old.amount_minor where id = old.wallet_id;
      update wallets set balance_minor = balance_minor - old.amount_minor where id = old.destination_wallet_id;
    end if;
    if new.type = 'expense' then
      update wallets set balance_minor = balance_minor - new.amount_minor where id = new.wallet_id;
    elsif new.type = 'income' then
      update wallets set balance_minor = balance_minor + new.amount_minor where id = new.wallet_id;
    elsif new.type = 'transfer' then
      update wallets set balance_minor = balance_minor - new.amount_minor where id = new.wallet_id;
      update wallets set balance_minor = balance_minor + new.amount_minor where id = new.destination_wallet_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

create trigger transactions_sync_wallet_balance
after insert or update or delete on transactions
for each row execute function sync_wallet_balance();

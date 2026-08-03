-- Core schema for the personal finance webapp.
-- Money is always stored as an integer in minor units (amount_minor = 1250 means 12.50).

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  google_sub text,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income', 'transfer', 'bill')),
  color text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  occurred_on date not null,
  amount_minor bigint not null,
  currency text not null default 'SGD',
  type text not null check (type in ('expense', 'income')),
  category_id uuid references categories(id),
  merchant text,
  notes text,
  created_at timestamptz not null default now()
);

create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  target_price_minor bigint,
  current_price_minor bigint,
  url text,
  priority text check (priority in ('low', 'medium', 'high')),
  status text not null default 'active' check (status in ('active', 'purchased', 'paused', 'archived')),
  target_date date,
  notes text,
  purchased_transaction_id uuid references transactions(id),
  created_at timestamptz not null default now()
);

create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  amount_minor bigint not null,
  currency text not null default 'SGD',
  category_id uuid references categories(id),
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly', 'custom_months')),
  interval_count int not null default 1,
  anchor_date date not null,
  next_due_on date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  recurring_rule_id uuid not null references recurring_rules(id) on delete cascade,
  due_on date not null,
  amount_minor bigint not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'skipped')),
  transaction_id uuid references transactions(id),
  created_at timestamptz not null default now()
);

-- Indexes for the query patterns the app actually uses: date-range and
-- category filtering on transactions, upcoming-due lookups on recurring
-- data, and status filtering on the wishlist.
create index transactions_user_occurred_on_idx on transactions (user_id, occurred_on desc);
create index transactions_user_category_idx on transactions (user_id, category_id);
create index categories_user_id_idx on categories (user_id);
create index wishlist_items_user_status_idx on wishlist_items (user_id, status);
create index recurring_rules_user_next_due_idx on recurring_rules (user_id, next_due_on);
create index recurring_occurrences_rule_due_idx on recurring_occurrences (recurring_rule_id, due_on);
create index recurring_occurrences_rule_status_idx on recurring_occurrences (recurring_rule_id, status);

-- Row Level Security: every table restricted to rows owned by the caller.
alter table profiles enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table wishlist_items enable row level security;
alter table recurring_rules enable row level security;
alter table recurring_occurrences enable row level security;

-- profiles: keyed by auth.users id directly, no separate user_id column.
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- categories
create policy "categories_select_own" on categories
  for select using (user_id = auth.uid());

create policy "categories_insert_own" on categories
  for insert with check (user_id = auth.uid());

create policy "categories_update_own" on categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories_delete_own" on categories
  for delete using (user_id = auth.uid());

-- transactions
create policy "transactions_select_own" on transactions
  for select using (user_id = auth.uid());

create policy "transactions_insert_own" on transactions
  for insert with check (user_id = auth.uid());

create policy "transactions_update_own" on transactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "transactions_delete_own" on transactions
  for delete using (user_id = auth.uid());

-- wishlist_items
create policy "wishlist_items_select_own" on wishlist_items
  for select using (user_id = auth.uid());

create policy "wishlist_items_insert_own" on wishlist_items
  for insert with check (user_id = auth.uid());

create policy "wishlist_items_update_own" on wishlist_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wishlist_items_delete_own" on wishlist_items
  for delete using (user_id = auth.uid());

-- recurring_rules
create policy "recurring_rules_select_own" on recurring_rules
  for select using (user_id = auth.uid());

create policy "recurring_rules_insert_own" on recurring_rules
  for insert with check (user_id = auth.uid());

create policy "recurring_rules_update_own" on recurring_rules
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "recurring_rules_delete_own" on recurring_rules
  for delete using (user_id = auth.uid());

-- recurring_occurrences: no direct user_id, ownership goes through the parent rule.
create policy "recurring_occurrences_select_own" on recurring_occurrences
  for select using (
    exists (
      select 1 from recurring_rules
      where recurring_rules.id = recurring_occurrences.recurring_rule_id
        and recurring_rules.user_id = auth.uid()
    )
  );

create policy "recurring_occurrences_insert_own" on recurring_occurrences
  for insert with check (
    exists (
      select 1 from recurring_rules
      where recurring_rules.id = recurring_occurrences.recurring_rule_id
        and recurring_rules.user_id = auth.uid()
    )
  );

create policy "recurring_occurrences_update_own" on recurring_occurrences
  for update using (
    exists (
      select 1 from recurring_rules
      where recurring_rules.id = recurring_occurrences.recurring_rule_id
        and recurring_rules.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from recurring_rules
      where recurring_rules.id = recurring_occurrences.recurring_rule_id
        and recurring_rules.user_id = auth.uid()
    )
  );

create policy "recurring_occurrences_delete_own" on recurring_occurrences
  for delete using (
    exists (
      select 1 from recurring_rules
      where recurring_rules.id = recurring_occurrences.recurring_rule_id
        and recurring_rules.user_id = auth.uid()
    )
  );

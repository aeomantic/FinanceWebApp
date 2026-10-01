begin;
create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  category_id uuid references public.categories(id) on delete set null,
  category_key text,
  icon_name text not null default 'store',
  logo_url text,
  brand_color text not null default '#FEF38B',
  created_at timestamptz not null default now(),
  constraint merchants_system_category_check check (user_id is not null or category_id is null),
  constraint merchants_color_check check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint merchants_logo_check check (logo_url is null or logo_url ~ '^https://')
);
-- Nullable owners need a separate uniqueness rule for system presets.
create unique index if not exists merchants_owner_name_key
  on public.merchants(user_id, lower(btrim(name))) where user_id is not null;
create unique index if not exists merchants_system_name_key
  on public.merchants(lower(btrim(name))) where user_id is null;
create index if not exists merchants_category_idx on public.merchants(category_id);
alter table public.transactions add column if not exists merchant_id uuid
  references public.merchants(id) on delete set null;
create index if not exists transactions_merchant_idx on public.transactions(merchant_id);
alter table public.merchants enable row level security;
revoke all on public.merchants from anon;
grant select, insert, update, delete on public.merchants to authenticated;
drop policy if exists merchants_select on public.merchants;
create policy merchants_select on public.merchants for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
drop policy if exists merchants_insert on public.merchants;
create policy merchants_insert on public.merchants for insert to authenticated
  with check (user_id = (select auth.uid()) and (category_id is null or exists (
    select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())
  )));
drop policy if exists merchants_update on public.merchants;
create policy merchants_update on public.merchants for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (category_id is null or exists (
    select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())
  )));
drop policy if exists merchants_delete on public.merchants;
create policy merchants_delete on public.merchants for delete to authenticated
  using (user_id = (select auth.uid()));
-- Restrictive policies AND with existing wallet/category ownership policies.
-- A foreign key alone would allow referencing another user's private merchant.
drop policy if exists transactions_merchant_insert on public.transactions;
create policy transactions_merchant_insert on public.transactions as restrictive for insert to authenticated
  with check (merchant_id is null or (type <> 'transfer' and exists (
    select 1 from public.merchants m where m.id = merchant_id
      and (m.user_id is null or m.user_id = transactions.user_id)
  )));
drop policy if exists transactions_merchant_update on public.transactions;
create policy transactions_merchant_update on public.transactions as restrictive for update to authenticated
  using (true) with check (merchant_id is null or (type <> 'transfer' and exists (
    select 1 from public.merchants m where m.id = merchant_id
      and (m.user_id is null or m.user_id = transactions.user_id)
  )));
insert into public.merchants(name, category_key, icon_name, brand_color) values
 ('NTUC FairPrice','groceries','shopping-cart','#E02F36'),
 ('Cold Storage','groceries','shopping-cart','#247747'),
 ('Sheng Siong','groceries','shopping-cart','#F2B233'),
 ('Don Don Donki','groceries','shopping-cart','#E8C834'),
 ('Giant','groceries','shopping-cart','#77B948'),
 ('McDonald''s','food','utensils','#FFC72C'),
 ('Starbucks','food','coffee','#00754A'),
 ('Toast Box','food','coffee','#B96938'),
 ('Koufu','food','utensils','#D3383A'),
 ('Subway','food','utensils','#008C44'),
 ('GrabFood','food','utensils','#00B14F'),
 ('Grab','transport','car','#00B14F'),
 ('Gojek','transport','car','#00AA13'),
 ('ComfortDelGro','transport','car','#1455A0'),
 ('SimplyGo','transport','bus','#6556AE'),
 ('MRT','transport','bus','#D63438'),
 ('Shopee','shopping','shopping-bag','#EE4D2D'),
 ('Lazada','shopping','shopping-bag','#F87524'),
 ('Amazon','shopping','shopping-bag','#FF9900'),
 ('Apple','shopping','laptop','#747474'),
 ('Challenger','shopping','laptop','#DE2935')
on conflict (lower(btrim(name))) where user_id is null do nothing;
notify pgrst, 'reload schema';
commit;

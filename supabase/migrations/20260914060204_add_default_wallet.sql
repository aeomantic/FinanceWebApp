-- Lets the owner mark one wallet as the default, so the dashboard has a
-- deterministic wallet to select on load instead of just "whichever one
-- sorts first."
alter table wallets add column is_default boolean not null default false;

-- Enforces at most one default per user at the database level, not just in
-- application code: a partial unique index on user_id where is_default is
-- true rejects a second true row outright.
create unique index wallets_one_default_per_user on wallets (user_id) where is_default;

-- Backfill: any user who already has wallets but none marked default gets
-- their oldest wallet promoted, so existing accounts aren't left with no
-- default wallet after this migration.
update wallets w
set is_default = true
where w.id = (
  select w2.id from wallets w2
  where w2.user_id = w.user_id
  order by w2.created_at asc
  limit 1
)
and not exists (
  select 1 from wallets w3 where w3.user_id = w.user_id and w3.is_default
);

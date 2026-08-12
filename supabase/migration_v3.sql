create unique index if not exists uq_telegram_accounts_telegram_user
on telegram_accounts(telegram_user_id);

alter table admin_sessions
add column if not exists metadata jsonb;

alter table telegram_accounts
add column if not exists display_name text;

alter table telegram_accounts
add column if not exists username text;

alter table telegram_accounts
add column if not exists last_connected_at timestamptz;

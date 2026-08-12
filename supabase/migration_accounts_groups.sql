alter table user_groups
add column if not exists telegram_account_id uuid
references telegram_accounts(id)
on delete cascade;

alter table messages
add column if not exists telegram_account_id uuid
references telegram_accounts(id)
on delete cascade;

alter table scheduled_messages
add column if not exists telegram_account_id uuid
references telegram_accounts(id)
on delete cascade;

create index if not exists idx_user_groups_account
on user_groups(telegram_account_id);

create index if not exists idx_messages_account
on messages(telegram_account_id);

create index if not exists idx_scheduled_messages_account
on scheduled_messages(telegram_account_id);

create unique index if not exists uq_user_group_account
on user_groups(user_id, telegram_account_id, group_id);

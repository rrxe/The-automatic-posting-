alter table user_groups
add column if not exists source text not null default 'legacy';

update user_groups
set source = 'legacy'
where source is null;

create index if not exists idx_user_groups_manual
on user_groups(user_id, telegram_account_id, source);

alter table messages
alter column signature_enabled
set default true;

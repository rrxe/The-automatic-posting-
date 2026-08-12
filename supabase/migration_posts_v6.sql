create table if not exists post_drafts (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null references users(id) on delete cascade,
    telegram_account_id uuid not null references telegram_accounts(id) on delete cascade,

    content text not null default '',
    signature_enabled boolean not null default true,

    selected_group_ids uuid[] not null default '{}'::uuid[],

    status text not null default 'draft',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_post_drafts_user
on post_drafts(user_id, updated_at desc);

create index if not exists idx_post_drafts_account
on post_drafts(telegram_account_id);

alter table mandatory_settings
add column if not exists free_message_limit integer not null default 100;

alter table mandatory_settings
add column if not exists vip_message_limit integer not null default 500;

alter table mandatory_settings
add column if not exists free_daily_runs integer not null default 4;

alter table mandatory_settings
add column if not exists vip_daily_runs integer not null default 4;

alter table mandatory_settings
add column if not exists free_session_minutes integer not null default 30;

alter table mandatory_settings
add column if not exists vip_session_minutes integer not null default 120;

update mandatory_settings
set
    free_message_limit = 100
where id = 1
  and free_message_limit is null;

update mandatory_settings
set
    vip_message_limit = 500
where id = 1
  and vip_message_limit is null;

update mandatory_settings
set
    free_daily_runs = 4
where id = 1
  and free_daily_runs is null;

update mandatory_settings
set
    vip_daily_runs = 4
where id = 1
  and vip_daily_runs is null;

update mandatory_settings
set
    free_session_minutes = 30
where id = 1
  and free_session_minutes is null;

update mandatory_settings
set
    vip_session_minutes = 120
where id = 1
  and vip_session_minutes is null;

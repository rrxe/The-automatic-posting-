alter table messages
add column if not exists max_length integer;

alter table messages
add column if not exists signature_enabled boolean not null default true;

alter table messages
add column if not exists send_mode text not null default 'manual';

alter table messages
add column if not exists scheduled_at timestamptz;

create table if not exists publish_runs (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null references users(id) on delete cascade,
    telegram_account_id uuid not null references telegram_accounts(id) on delete cascade,
    message_id uuid not null references messages(id) on delete cascade,

    status text not null default 'pending',

    target_count integer not null default 0,
    success_count integer not null default 0,
    failed_count integer not null default 0,

    started_at timestamptz,
    finished_at timestamptz,

    created_at timestamptz not null default now()
);

create table if not exists publish_run_targets (
    id uuid primary key default gen_random_uuid(),

    run_id uuid not null references publish_runs(id) on delete cascade,
    group_id uuid not null references groups(id) on delete cascade,

    status text not null default 'pending',
    error_message text,

    sent_at timestamptz,
    created_at timestamptz not null default now(),

    unique(run_id, group_id)
);

create index if not exists idx_publish_runs_user
on publish_runs(user_id, created_at desc);

create index if not exists idx_publish_run_targets_run
on publish_run_targets(run_id);

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
    free_message_limit = coalesce(free_message_limit, 100),
    vip_message_limit = coalesce(vip_message_limit, 500),
    free_daily_runs = coalesce(free_daily_runs, 4),
    vip_daily_runs = coalesce(vip_daily_runs, 4),
    free_session_minutes = coalesce(free_session_minutes, 30),
    vip_session_minutes = coalesce(vip_session_minutes, 120)
where id = 1;

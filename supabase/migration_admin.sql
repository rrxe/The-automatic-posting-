create table if not exists admin_sessions (
    telegram_id bigint primary key,
    action text not null,
    expires_at timestamptz not null default (now() + interval '10 minutes'),
    created_at timestamptz not null default now()
);

create index if not exists idx_admin_sessions_expires
on admin_sessions(expires_at);

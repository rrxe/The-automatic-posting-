create table if not exists user_actions (
    telegram_id bigint primary key,
    action text not null,
    expires_at timestamptz not null default (now() + interval '10 minutes'),
    created_at timestamptz not null default now()
);

create index if not exists idx_user_actions_expires
on user_actions(expires_at);

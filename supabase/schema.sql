create extension if not exists pgcrypto;

create type user_plan as enum ('free', 'vip');
create type admin_role as enum ('owner', 'admin');

create table users (
    id uuid primary key default gen_random_uuid(),
    telegram_id bigint unique not null,
    username text,
    first_name text,
    language text not null default 'ar',
    plan user_plan not null default 'free',
    vip_expires_at timestamptz,
    referred_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table admin_users (
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique not null references users(id) on delete cascade,
    role admin_role not null default 'admin',
    created_at timestamptz not null default now()
);

create table referrals (
    id uuid primary key default gen_random_uuid(),
    referrer_id uuid not null references users(id) on delete cascade,
    referred_user_id uuid unique not null references users(id) on delete cascade,
    status text not null default 'confirmed',
    created_at timestamptz not null default now(),

    constraint referral_not_self
        check (referrer_id <> referred_user_id)
);

create table vip_grants (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    source text not null,
    duration_days integer not null,
    starts_at timestamptz not null default now(),
    expires_at timestamptz not null,
    granted_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now()
);

create table mandatory_channels (
    id uuid primary key default gen_random_uuid(),
    chat_id bigint unique not null,
    username text,
    title text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table telegram_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    telegram_user_id bigint not null,
    phone_hint text,
    session_encrypted text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique(user_id, telegram_user_id)
);

create table groups (
    id uuid primary key default gen_random_uuid(),
    telegram_chat_id bigint unique not null,
    title text,
    username text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table user_groups (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    group_id uuid not null references groups(id) on delete cascade,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),

    unique(user_id, group_id)
);

create table messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    content text not null,
    signature_enabled boolean not null default true,
    status text not null default 'draft',
    created_at timestamptz not null default now()
);

create table scheduled_messages (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references messages(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    scheduled_at timestamptz not null,
    status text not null default 'pending',
    created_at timestamptz not null default now()
);

create table mandatory_settings (
    id integer primary key default 1,

    free_group_limit integer not null default 3,
    vip_group_limit integer not null default 20,

    referral_7_vip_days integer not null default 3,
    referral_20_vip_days integer not null default 7,

    vip_price_usdt numeric(10,2) not null default 5.00,

    signature text not null default '⚡ @YourBot',

    constraint single_settings_row
        check (id = 1)
);

insert into mandatory_settings (id)
values (1)
on conflict (id) do nothing;

create table audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid references users(id) on delete set null,
    action text not null,
    target_user_id uuid references users(id) on delete set null,
    metadata jsonb,
    created_at timestamptz not null default now()
);

create index idx_users_telegram_id
    on users(telegram_id);

create index idx_referrals_referrer
    on referrals(referrer_id);

create index idx_telegram_accounts_user
    on telegram_accounts(user_id);

create index idx_user_groups_user
    on user_groups(user_id);

create index idx_messages_user
    on messages(user_id);

create index idx_scheduled_messages_time
    on scheduled_messages(scheduled_at);

create index idx_audit_logs_created
    on audit_logs(created_at);

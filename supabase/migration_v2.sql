alter table mandatory_channels
add column if not exists invite_url text;

alter table mandatory_channels
add column if not exists sort_order integer not null default 0;

create index if not exists idx_mandatory_channels_active
on mandatory_channels(is_active, sort_order);

create index if not exists idx_vip_grants_user_source
on vip_grants(user_id, source);

alter table mandatory_settings
add column if not exists free_account_limit integer not null default 2;

alter table mandatory_settings
add column if not exists vip_account_limit integer not null default 5;

update mandatory_settings
set
    free_account_limit = 2,
    vip_account_limit = 5
where id = 1;

create table if not exists public.app_api_keys (
  id text primary key,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes jsonb not null default '[]'::jsonb,
  rate_limit_per_min integer not null default 60,
  allowed_ips jsonb not null default '[]'::jsonb,
  allowed_domains jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists idx_app_api_keys_hash on public.app_api_keys(key_hash);
create index if not exists idx_app_api_keys_active on public.app_api_keys(revoked_at, expires_at);

create table if not exists public.app_partner_aliases (
  alias text primary key,
  key_id text not null,
  external_ref text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_accessed_at timestamptz
);

create index if not exists idx_app_partner_aliases_key_id on public.app_partner_aliases(key_id);

create table if not exists public.app_partner_access_logs (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  key_id text,
  alias text,
  route text not null,
  status integer not null,
  ip text,
  meta jsonb
);

create index if not exists idx_app_partner_access_logs_key_time
on public.app_partner_access_logs(key_id, timestamp desc);

alter table public.app_api_keys disable row level security;
alter table public.app_partner_aliases disable row level security;
alter table public.app_partner_access_logs disable row level security;

drop trigger if exists trg_app_api_keys_updated_at on public.app_api_keys;
create trigger trg_app_api_keys_updated_at
before update on public.app_api_keys
for each row execute function public.set_updated_at();

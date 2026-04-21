-- Supabase schema template (structured tables)
-- Copy this file and edit table names if starting a new project.

create table if not exists public.app_aliases (
  address text primary key,
  created_at timestamptz,
  last_used_at timestamptz,
  hits integer not null default 0,
  active boolean not null default true
);

create table if not exists public.app_domains (
  name text primary key,
  active boolean not null default true,
  created_at timestamptz
);

create table if not exists public.app_logs (
  id text primary key,
  alias text,
  from_email text,
  subject text,
  date text,
  snippet text,
  last_seen_at timestamptz
);

create table if not exists public.app_audit (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null,
  action text not null,
  ip text,
  user_agent text,
  meta jsonb
);

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

create table if not exists public.app_partner_aliases (
  alias text primary key,
  key_id text not null,
  external_ref text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_accessed_at timestamptz
);

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

alter table public.app_aliases disable row level security;
alter table public.app_domains disable row level security;
alter table public.app_logs disable row level security;
alter table public.app_audit disable row level security;
alter table public.app_api_keys disable row level security;
alter table public.app_partner_aliases disable row level security;
alter table public.app_partner_access_logs disable row level security;

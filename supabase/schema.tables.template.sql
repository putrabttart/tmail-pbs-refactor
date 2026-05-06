-- Supabase schema template (structured tables with multi-tenant support)
-- Copy this file and edit table names if starting a new project.
-- All tables include tenant_id for data isolation between tenants.

-- Tenants registry
create table if not exists public.tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  config jsonb not null default '{}'::jsonb,
  google_client_id text,
  google_client_secret text,
  google_redirect_uri text,
  admin_emails jsonb not null default '[]'::jsonb,
  allowed_origins jsonb not null default '[]'::jsonb,
  max_messages integer not null default 20,
  max_logs integer not null default 5000,
  partner_api_enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tenants_slug on public.tenants(slug);
alter table public.tenants disable row level security;

-- KV Store (per-tenant)
create table if not exists public.app_kv (
  tenant_id text not null default 'default',
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create index if not exists idx_app_kv_tenant on public.app_kv(tenant_id);
alter table public.app_kv disable row level security;

-- Aliases (per-tenant)
create table if not exists public.app_aliases (
  tenant_id text not null default 'default',
  address text not null,
  created_at timestamptz,
  last_used_at timestamptz,
  hits integer not null default 0,
  active boolean not null default true,
  primary key (tenant_id, address)
);

create index if not exists idx_app_aliases_tenant on public.app_aliases(tenant_id);
create index if not exists idx_app_aliases_tenant_active on public.app_aliases(tenant_id, active);
alter table public.app_aliases disable row level security;

-- Domains (per-tenant)
create table if not exists public.app_domains (
  tenant_id text not null default 'default',
  name text not null,
  active boolean not null default true,
  created_at timestamptz,
  primary key (tenant_id, name)
);

create index if not exists idx_app_domains_tenant on public.app_domains(tenant_id);
create index if not exists idx_app_domains_tenant_active on public.app_domains(tenant_id, active);
alter table public.app_domains disable row level security;

-- Email Logs (per-tenant)
create table if not exists public.app_logs (
  tenant_id text not null default 'default',
  id text not null,
  alias text,
  from_email text,
  subject text,
  date text,
  snippet text,
  last_seen_at timestamptz,
  primary key (tenant_id, id)
);

create index if not exists idx_app_logs_tenant on public.app_logs(tenant_id);
create index if not exists idx_app_logs_tenant_alias on public.app_logs(tenant_id, alias);
alter table public.app_logs disable row level security;

-- Audit Trail (per-tenant)
create table if not exists public.app_audit (
  id bigint generated always as identity primary key,
  tenant_id text not null default 'default',
  timestamp timestamptz not null,
  action text not null,
  ip text,
  user_agent text,
  meta jsonb
);

create index if not exists idx_app_audit_tenant on public.app_audit(tenant_id);
create index if not exists idx_app_audit_tenant_time on public.app_audit(tenant_id, timestamp desc);
alter table public.app_audit disable row level security;

-- API Keys (per-tenant)
create table if not exists public.app_api_keys (
  id text primary key,
  tenant_id text not null default 'default',
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
create index if not exists idx_app_api_keys_tenant on public.app_api_keys(tenant_id);
create index if not exists idx_app_api_keys_tenant_active on public.app_api_keys(tenant_id, revoked_at, expires_at);
alter table public.app_api_keys disable row level security;

-- Partner Aliases (per-tenant)
create table if not exists public.app_partner_aliases (
  tenant_id text not null default 'default',
  alias text not null,
  key_id text not null,
  external_ref text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_accessed_at timestamptz,
  primary key (tenant_id, alias)
);

create index if not exists idx_app_partner_aliases_tenant on public.app_partner_aliases(tenant_id);
create index if not exists idx_app_partner_aliases_tenant_key on public.app_partner_aliases(tenant_id, key_id);
alter table public.app_partner_aliases disable row level security;

-- Partner Access Logs (per-tenant)
create table if not exists public.app_partner_access_logs (
  id bigint generated always as identity primary key,
  tenant_id text not null default 'default',
  timestamp timestamptz not null default now(),
  key_id text,
  alias text,
  route text not null,
  status integer not null,
  ip text,
  meta jsonb
);

create index if not exists idx_app_partner_access_logs_tenant on public.app_partner_access_logs(tenant_id);
create index if not exists idx_app_partner_access_logs_tenant_key_time
  on public.app_partner_access_logs(tenant_id, key_id, timestamp desc);
alter table public.app_partner_access_logs disable row level security;

-- Triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_kv_updated_at on public.app_kv;
create trigger trg_app_kv_updated_at
before update on public.app_kv
for each row execute function public.set_updated_at();

drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists trg_app_api_keys_updated_at on public.app_api_keys;
create trigger trg_app_api_keys_updated_at
before update on public.app_api_keys
for each row execute function public.set_updated_at();

-- Insert default tenant
insert into public.tenants (id, name, slug, config)
values ('default', 'Default Tenant', 'default', '{"theme": "blue"}'::jsonb)
on conflict (id) do nothing;

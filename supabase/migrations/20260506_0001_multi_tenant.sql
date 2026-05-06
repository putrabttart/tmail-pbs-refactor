-- ============================================================
-- MULTI-TENANT MIGRATION
-- Adds tenant isolation to all tables
-- Each deployment identifies itself via TENANT_ID env variable
-- ============================================================

-- 1. Create tenants registry table
create table if not exists public.tenants (
  id text primary key,                          -- e.g. "pbs", "acme", "client-x"
  name text not null,                           -- Display name
  slug text not null unique,                    -- URL-safe identifier (for subdomain routing)
  config jsonb not null default '{}'::jsonb,    -- Tenant-specific config (theme, branding, limits)
  google_client_id text,                        -- Per-tenant Google OAuth credentials
  google_client_secret text,                    -- Per-tenant Google OAuth secret
  google_redirect_uri text,                     -- Per-tenant OAuth redirect URI
  admin_emails jsonb not null default '[]'::jsonb,  -- Tenant admin email list
  allowed_origins jsonb not null default '[]'::jsonb, -- CORS origins for this tenant
  max_messages integer not null default 20,
  max_logs integer not null default 5000,
  partner_api_enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tenants_slug on public.tenants(slug);

alter table public.tenants disable row level security;

-- Auto-update updated_at
drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

-- 2. Add tenant_id column to app_kv
alter table public.app_kv drop constraint if exists app_kv_pkey;
alter table public.app_kv add column if not exists tenant_id text not null default 'default';
alter table public.app_kv add primary key (tenant_id, key);
create index if not exists idx_app_kv_tenant on public.app_kv(tenant_id);

-- 3. Add tenant_id column to app_aliases
alter table public.app_aliases drop constraint if exists app_aliases_pkey;
alter table public.app_aliases add column if not exists tenant_id text not null default 'default';
alter table public.app_aliases add primary key (tenant_id, address);
create index if not exists idx_app_aliases_tenant on public.app_aliases(tenant_id);
create index if not exists idx_app_aliases_tenant_active on public.app_aliases(tenant_id, active);

-- 4. Add tenant_id column to app_domains
alter table public.app_domains drop constraint if exists app_domains_pkey;
alter table public.app_domains add column if not exists tenant_id text not null default 'default';
alter table public.app_domains add primary key (tenant_id, name);
create index if not exists idx_app_domains_tenant on public.app_domains(tenant_id);
create index if not exists idx_app_domains_tenant_active on public.app_domains(tenant_id, active);

-- 5. Add tenant_id column to app_logs
alter table public.app_logs drop constraint if exists app_logs_pkey;
alter table public.app_logs add column if not exists tenant_id text not null default 'default';
alter table public.app_logs add primary key (tenant_id, id);
create index if not exists idx_app_logs_tenant on public.app_logs(tenant_id);
create index if not exists idx_app_logs_tenant_alias on public.app_logs(tenant_id, alias);

-- 6. Add tenant_id column to app_audit
alter table public.app_audit add column if not exists tenant_id text not null default 'default';
create index if not exists idx_app_audit_tenant on public.app_audit(tenant_id);
create index if not exists idx_app_audit_tenant_time on public.app_audit(tenant_id, timestamp desc);

-- 7. Add tenant_id column to app_api_keys
alter table public.app_api_keys add column if not exists tenant_id text not null default 'default';
create index if not exists idx_app_api_keys_tenant on public.app_api_keys(tenant_id);
create index if not exists idx_app_api_keys_tenant_active on public.app_api_keys(tenant_id, revoked_at, expires_at);

-- 8. Add tenant_id column to app_partner_aliases
alter table public.app_partner_aliases drop constraint if exists app_partner_aliases_pkey;
alter table public.app_partner_aliases add column if not exists tenant_id text not null default 'default';
alter table public.app_partner_aliases add primary key (tenant_id, alias);
create index if not exists idx_app_partner_aliases_tenant on public.app_partner_aliases(tenant_id);
create index if not exists idx_app_partner_aliases_tenant_key on public.app_partner_aliases(tenant_id, key_id);

-- 9. Add tenant_id column to app_partner_access_logs
alter table public.app_partner_access_logs add column if not exists tenant_id text not null default 'default';
create index if not exists idx_app_partner_access_logs_tenant on public.app_partner_access_logs(tenant_id);
create index if not exists idx_app_partner_access_logs_tenant_key_time 
  on public.app_partner_access_logs(tenant_id, key_id, timestamp desc);

-- 10. Insert default tenant for backward compatibility
insert into public.tenants (id, name, slug, config)
values ('default', 'Default Tenant', 'default', '{"theme": "blue"}'::jsonb)
on conflict (id) do nothing;

-- 11. Add RLS policies (optional, for extra security layer)
-- Note: We keep RLS disabled since we use service_role key,
-- but add policies for future flexibility

-- Enable RLS on tenants table only
alter table public.tenants enable row level security;

-- Policy: service_role can do everything
create policy "service_role_all" on public.tenants
  for all using (true) with check (true);

/**
 * Tenant Management Module
 * 
 * Handles multi-tenant context resolution, configuration loading,
 * and tenant-scoped database operations.
 * 
 * Tenant identification strategy:
 * - TENANT_ID environment variable (primary, for deployment-level isolation)
 * - Subdomain detection from request Host header (secondary, for shared deployments)
 * - Falls back to 'default' if neither is set
 */

// ========== TENANT ID RESOLUTION ==========

const ENV_TENANT_ID = (process.env.TENANT_ID || '').trim().toLowerCase() || 'default';

/**
 * Resolve tenant ID from request context.
 * Priority: TENANT_ID env > x-tenant-id header > subdomain > 'default'
 */
export function resolveTenantId(request = null) {
  // 1. Environment variable takes highest priority (deployment-level)
  if (ENV_TENANT_ID && ENV_TENANT_ID !== 'default') {
    return ENV_TENANT_ID;
  }

  if (!request) return ENV_TENANT_ID;

  // 2. Explicit header (useful for API testing / multi-tenant proxy)
  const headerTenant = (request.headers?.get?.('x-tenant-id') || '').trim().toLowerCase();
  if (headerTenant) return headerTenant;

  // 3. Subdomain-based resolution
  const host = (request.headers?.get?.('host') || '').toLowerCase();
  if (host) {
    const subdomain = extractSubdomain(host);
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      return subdomain;
    }
  }

  return ENV_TENANT_ID;
}

/**
 * Extract subdomain from host header.
 * e.g. "tenant1.tmail.example.com" -> "tenant1"
 * e.g. "tmail.example.com" -> null (no subdomain)
 * e.g. "localhost:3000" -> null
 * e.g. "my-app.vercel.app" -> null (platform domain, not a tenant)
 */
function extractSubdomain(host) {
  // Remove port
  const hostname = host.split(':')[0];

  // Skip localhost and IP addresses
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  // Skip platform deployment domains (xxx.vercel.app, xxx.netlify.app, etc.)
  const PLATFORM_DOMAINS = ['vercel.app', 'netlify.app', 'railway.app', 'onrender.com'];
  if (PLATFORM_DOMAINS.some(d => hostname.endsWith(d))) {
    return null;
  }

  const parts = hostname.split('.');
  // Need at least 3 parts for a subdomain (sub.domain.tld)
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

// ========== TENANT CONFIG CACHE ==========

const tenantConfigCache = new Map();
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get tenant configuration from database (with cache).
 * Returns null if tenant doesn't exist or is inactive.
 */
export async function getTenantConfig(tenantId, supabaseClient) {
  if (!supabaseClient) return getDefaultTenantConfig(tenantId);

  const cacheKey = `tenant:${tenantId}`;
  const cached = tenantConfigCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const { data, error } = await supabaseClient
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) {
    // Fallback: if tenant not found in DB, use env-based config
    const fallback = getDefaultTenantConfig(tenantId);
    tenantConfigCache.set(cacheKey, {
      value: fallback,
      expiresAt: Date.now() + 60_000 // Cache miss for 1 minute only
    });
    return fallback;
  }

  const config = {
    id: data.id,
    name: data.name,
    slug: data.slug,
    config: data.config || {},
    googleClientId: data.google_client_id,
    googleClientSecret: data.google_client_secret,
    googleRedirectUri: data.google_redirect_uri,
    adminEmails: Array.isArray(data.admin_emails) ? data.admin_emails : [],
    allowedOrigins: Array.isArray(data.allowed_origins) ? data.allowed_origins : [],
    maxMessages: data.max_messages || 20,
    maxLogs: data.max_logs || 5000,
    partnerApiEnabled: data.partner_api_enabled !== false,
    active: data.active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };

  tenantConfigCache.set(cacheKey, {
    value: config,
    expiresAt: Date.now() + TENANT_CACHE_TTL_MS
  });

  return config;
}

/**
 * Default tenant config when database lookup fails or is unavailable.
 * Uses environment variables as fallback.
 */
function getDefaultTenantConfig(tenantId) {
  return {
    id: tenantId,
    name: tenantId,
    slug: tenantId,
    config: { theme: 'blue' },
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || null,
    adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(v => v.trim()).filter(Boolean),
    maxMessages: parseInt(process.env.MAX_MESSAGES || '20', 10) || 20,
    maxLogs: parseInt(process.env.MAX_LOGS || '5000', 10) || 5000,
    partnerApiEnabled: true,
    active: true,
    createdAt: null,
    updatedAt: null
  };
}

/**
 * Invalidate tenant config cache (e.g. after admin updates).
 */
export function invalidateTenantCache(tenantId = null) {
  if (tenantId) {
    tenantConfigCache.delete(`tenant:${tenantId}`);
  } else {
    tenantConfigCache.clear();
  }
}

// ========== TENANT-SCOPED HELPERS ==========

/**
 * Create a tenant context object that carries tenant ID through operations.
 */
export function createTenantContext(request = null) {
  const tenantId = resolveTenantId(request);
  return {
    tenantId,
    request
  };
}

/**
 * Validate that a tenant ID is well-formed.
 */
export function isValidTenantId(id) {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim().toLowerCase();
  // Allow alphanumeric, hyphens, underscores; 2-50 chars
  return /^[a-z0-9][a-z0-9_-]{1,48}[a-z0-9]$/.test(trimmed);
}

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tenantConfigCache.entries()) {
    if (entry.expiresAt < now) tenantConfigCache.delete(key);
  }
}, TENANT_CACHE_TTL_MS).unref();

export { ENV_TENANT_ID };

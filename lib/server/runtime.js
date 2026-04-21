import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { google } from 'googleapis';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const MODULE_INSTANCE_ID =
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const LOG_LEVELS = { info: 0, warn: 1, error: 2 };
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] >= CURRENT_LOG_LEVEL) {
    console.log(
      JSON.stringify({ level, message, ...meta, timestamp: new Date().toISOString() })
    );
  }
}

// ========== ENV VALIDATION ==========
const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().min(1),
  ADMIN_API_KEY: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  PARTNER_API_ENABLED: z.string().optional(),
  PARTNER_KEY_PEPPER: z.string().optional(),
  PARTNER_DEFAULT_RATE_LIMIT: z.string().optional(),
  PARTNER_MAX_WAIT_SECONDS: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  MAX_MESSAGES: z.string().optional(),
  MAX_LOGS: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  TOKEN_PATH: z.string().optional(),
  DATA_DIR: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_KV_TABLE: z.string().optional(),
  SUPABASE_TABLE_ALIASES: z.string().optional(),
  SUPABASE_TABLE_DOMAINS: z.string().optional(),
  SUPABASE_TABLE_LOGS: z.string().optional(),
  SUPABASE_TABLE_AUDIT: z.string().optional(),
  SUPABASE_TABLE_API_KEYS: z.string().optional(),
  SUPABASE_TABLE_PARTNER_ALIASES: z.string().optional(),
  SUPABASE_TABLE_PARTNER_ACCESS_LOGS: z.string().optional()
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Missing required environment variables: ${parsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`
    );
  }
  return parsed.data;
}

const env = loadEnv();
const ROOT_DIR = process.cwd();
const fsPromises = fs.promises;

const DEFAULT_DATA_DIR = path.join(ROOT_DIR, 'data');
const LEGACY_DATA_DIR = path.join(ROOT_DIR, 'gmail-backend', 'data');
const DATA_DIR = env.DATA_DIR || (fs.existsSync(DEFAULT_DATA_DIR) ? DEFAULT_DATA_DIR : LEGACY_DATA_DIR);

const DEFAULT_TOKEN_PATH = path.join(ROOT_DIR, 'token.json');
const LEGACY_TOKEN_PATH = path.join(ROOT_DIR, 'gmail-backend', 'token.json');
// Prefer new location, fallback to legacy hanya jika ada dan default belum ada
const TOKEN_PATH = env.TOKEN_PATH || DEFAULT_TOKEN_PATH;
const ALIASES_PATH = path.join(DATA_DIR, 'aliases.json');
const ALIAS_FILTERS_PATH = path.join(DATA_DIR, 'alias-filters.json');
const DOMAINS_PATH = path.join(DATA_DIR, 'domains.json');
const LOGS_PATH = path.join(DATA_DIR, 'logs.json');
const AUDIT_PATH = path.join(DATA_DIR, 'audit.json');
const API_KEYS_PATH = path.join(DATA_DIR, 'api-keys.json');
const PARTNER_ALIASES_PATH = path.join(DATA_DIR, 'partner-aliases.json');
const PARTNER_ACCESS_LOGS_PATH = path.join(DATA_DIR, 'partner-access-logs.json');

function parseBoolEnv(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const MAX_MESSAGES = Math.min(parseInt(env.MAX_MESSAGES || '20', 10) || 20, 50);
const MAX_LOGS = Math.min(parseInt(env.MAX_LOGS || '5000', 10) || 5000, 20000);
const TOKEN_ENCRYPTION_KEY = env.TOKEN_ENCRYPTION_KEY || null;
const PARTNER_API_ENABLED = parseBoolEnv(env.PARTNER_API_ENABLED, true);
const PARTNER_KEY_PEPPER = env.PARTNER_KEY_PEPPER || '';
const PARTNER_DEFAULT_RATE_LIMIT = Math.min(
  Math.max(parseInt(env.PARTNER_DEFAULT_RATE_LIMIT || '60', 10) || 60, 10),
  600
);
const PARTNER_MAX_WAIT_SECONDS = Math.min(
  Math.max(parseInt(env.PARTNER_MAX_WAIT_SECONDS || '20', 10) || 20, 0),
  60
);
const ADMIN_EMAILS = (env.ADMIN_EMAILS || '')
  .split(',')
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

const SUPABASE_URL = env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KV_TABLE = env.SUPABASE_KV_TABLE || 'app_kv';
const SUPABASE_TABLE_ALIASES = env.SUPABASE_TABLE_ALIASES || 'app_aliases';
const SUPABASE_TABLE_DOMAINS = env.SUPABASE_TABLE_DOMAINS || 'app_domains';
const SUPABASE_TABLE_LOGS = env.SUPABASE_TABLE_LOGS || 'app_logs';
const SUPABASE_TABLE_AUDIT = env.SUPABASE_TABLE_AUDIT || 'app_audit';
const SUPABASE_TABLE_API_KEYS = env.SUPABASE_TABLE_API_KEYS || 'app_api_keys';
const SUPABASE_TABLE_PARTNER_ALIASES =
  env.SUPABASE_TABLE_PARTNER_ALIASES || 'app_partner_aliases';
const SUPABASE_TABLE_PARTNER_ACCESS_LOGS =
  env.SUPABASE_TABLE_PARTNER_ACCESS_LOGS || 'app_partner_access_logs';
const USE_SUPABASE_STORAGE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

if (!USE_SUPABASE_STORAGE) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!USE_SUPABASE_STORAGE) return null;
  if (supabaseAdmin) return supabaseAdmin;
  const noStoreFetch = (input, init = {}) => {
    return fetch(input, {
      ...init,
      // Important: don't set both `cache` and `next.revalidate` (Next.js warns).
      // Supabase admin reads should always bypass caching.
      cache: 'no-store'
    });
  };
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch }
  });
  return supabaseAdmin;
}

const STORAGE_KEYS = {
  [TOKEN_PATH]: 'token',
  [ALIASES_PATH]: 'aliases',
  [ALIAS_FILTERS_PATH]: 'alias_filters',
  [DOMAINS_PATH]: 'domains',
  [LOGS_PATH]: 'logs',
  [AUDIT_PATH]: 'audit',
  [API_KEYS_PATH]: 'api_keys',
  [PARTNER_ALIASES_PATH]: 'partner_aliases',
  [PARTNER_ACCESS_LOGS_PATH]: 'partner_access_logs'
};

function getStorageKey(file) {
  return STORAGE_KEYS[file] || path.basename(file);
}

async function supabaseGet(key) {
  const client = getSupabaseAdmin();
  if (!client) return null;
  const { data, error } = await client
    .from(SUPABASE_KV_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    log('error', 'Supabase get failed', { key, error: error.message });
    return null;
  }
  return data?.value ?? null;
}

async function supabaseSet(key, value) {
  const client = getSupabaseAdmin();
  if (!client) return;
  const { error } = await client
    .from(SUPABASE_KV_TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) {
    log('error', 'Supabase set failed', { key, error: error.message });
  }
}

async function supabaseSelectAll(table, orderBy = null) {
  const client = getSupabaseAdmin();
  if (!client) return null;
  let query = client.from(table).select('*');
  if (orderBy) query = query.order(orderBy, { ascending: true });
  const { data, error } = await query;
  if (error) {
    log('error', 'Supabase select failed', { table, error: error.message });
    return null;
  }
  return data || [];
}

async function supabaseReplaceAll(table, rows, pkField) {
  const client = getSupabaseAdmin();
  if (!client) return;
  const { error: deleteError } = await client.from(table).delete().neq(pkField, '');
  if (deleteError) {
    log('error', 'Supabase delete failed', { table, error: deleteError.message });
    return;
  }
  if (!rows.length) return;
  const { error: insertError } = await client.from(table).insert(rows);
  if (insertError) {
    log('error', 'Supabase insert failed', { table, error: insertError.message });
  }
}

async function supabaseInsert(table, row) {
  const client = getSupabaseAdmin();
  if (!client) return;
  const { error } = await client.from(table).insert(row);
  if (error) {
    log('error', 'Supabase insert failed', { table, error: error.message });
  }
}

async function supabaseTrimByIdentity(table, orderColumn, limit) {
  const client = getSupabaseAdmin();
  if (!client) return;
  const { data, error } = await client
    .from(table)
    .select('id')
    .order(orderColumn, { ascending: false })
    .range(limit, limit + 1000);
  if (error || !data || !data.length) return;
  const ids = data.map((row) => row.id);
  await client.from(table).delete().in('id', ids);
}

async function supabaseTrimAudit(limit) {
  await supabaseTrimByIdentity(SUPABASE_TABLE_AUDIT, 'timestamp', limit);
}

async function supabaseTrimPartnerAccessLogs(limit) {
  await supabaseTrimByIdentity(SUPABASE_TABLE_PARTNER_ACCESS_LOGS, 'timestamp', limit);
}

async function fileExists(file) {
  try {
    await fsPromises.access(file);
    return true;
  } catch {
    return false;
  }
}

// ========== FILE HELPERS ==========
function encryptToken(text) {
  if (!TOKEN_ENCRYPTION_KEY) return text;
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptToken(text) {
  if (!TOKEN_ENCRYPTION_KEY) return text;
  const parts = text.split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted token format');
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function loadJson(file, fallback) {
  if (USE_SUPABASE_STORAGE) {
    const key = getStorageKey(file);
    const value = await supabaseGet(key);
    if (value == null) return fallback;
    if (file === TOKEN_PATH) {
      if (typeof value === 'string') {
        const content = TOKEN_ENCRYPTION_KEY ? decryptToken(value) : value;
        return JSON.parse(content);
      }
      return value;
    }
    return value;
  }

  if (!(await fileExists(file))) return fallback;
  try {
    const raw = await fsPromises.readFile(file, 'utf8');
    const content = file === TOKEN_PATH ? decryptToken(raw) : raw;
    return JSON.parse(content);
  } catch (e) {
    log('error', `Failed to parse ${file}`, { error: e.message });
    return fallback;
  }
}

async function saveJson(file, data) {
  if (USE_SUPABASE_STORAGE) {
    const key = getStorageKey(file);
    if (file === TOKEN_PATH) {
      const raw = JSON.stringify(data, null, 2);
      const content = TOKEN_ENCRYPTION_KEY ? encryptToken(raw) : raw;
      await supabaseSet(key, content);
      return;
    }
    await supabaseSet(key, data);
    return;
  }

  const raw = JSON.stringify(data, null, 2);
  const content = file === TOKEN_PATH ? encryptToken(raw) : raw;
  await fsPromises.writeFile(file, content);
}

async function loadAliases() {
  if (USE_SUPABASE_STORAGE) {
    const data = await supabaseSelectAll(SUPABASE_TABLE_ALIASES, 'created_at');
    if (!data) return [];
    const filterMap = await loadAliasFilterMap();
    return data.map((row) => ({
      address: row.address,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      hits: row.hits || 0,
      active: row.active,
      filterConfig: normalizeAliasFilterConfig(
        filterMap?.[String(row.address || '').toLowerCase()] || filterMap?.[row.address] || {}
      )
    }));
  }
  const data = await loadJson(ALIASES_PATH, []);
  return data.map((item) => ({
    ...item,
    filterConfig: normalizeAliasFilterConfig(item?.filterConfig || {})
  }));
}

async function saveAliases(list) {
  if (USE_SUPABASE_STORAGE) {
    const rows = list.map((item) => ({
      address: item.address,
      created_at: item.createdAt || null,
      last_used_at: item.lastUsedAt || null,
      hits: item.hits || 0,
      active: typeof item.active === 'boolean' ? item.active : true
    }));
    await supabaseReplaceAll(SUPABASE_TABLE_ALIASES, rows, 'address');

    // Only upsert filter keys here; do not delete to prevent accidental filter loss
    // from concurrent requests that save aliases without filter context.
    const filterMap = await loadAliasFilterMap();
    list.forEach((item) => {
      const key = String(item.address || '').toLowerCase();
      const normalized = normalizeAliasFilterConfig(item?.filterConfig || {});
      if (hasAliasFilter(normalized)) filterMap[key] = normalized;
    });
    await saveAliasFilterMap(filterMap);
    return;
  }
  const normalizedList = list.map((item) => ({
    ...item,
    filterConfig: normalizeAliasFilterConfig(item?.filterConfig || {})
  }));
  await saveJson(ALIASES_PATH, normalizedList);
}

async function loadAliasFilterMap() {
  const raw = await loadJson(ALIAS_FILTERS_PATH, {});
  if (!raw || typeof raw !== 'object') return {};
  const normalized = {};
  Object.entries(raw).forEach(([key, value]) => {
    normalized[String(key || '').toLowerCase()] = normalizeAliasFilterConfig(value || {});
  });
  return normalized;
}

async function saveAliasFilterMap(map) {
  const safe = map && typeof map === 'object' ? map : {};
  await saveJson(ALIAS_FILTERS_PATH, safe);
}

async function setAliasFilterConfig(address, filterConfig, { clearIfEmpty = false } = {}) {
  const key = String(address || '').toLowerCase();
  if (!key) return;
  const map = await loadAliasFilterMap();
  const normalized = normalizeAliasFilterConfig(filterConfig || {});
  if (hasAliasFilter(normalized)) {
    map[key] = normalized;
  } else if (clearIfEmpty) {
    delete map[key];
  }
  await saveAliasFilterMap(map);
}

async function loadDomains() {
  if (USE_SUPABASE_STORAGE) {
    const data = await supabaseSelectAll(SUPABASE_TABLE_DOMAINS, 'created_at');
    if (data && data.length) {
      return data.map((row) => ({
        name: row.name,
        active: typeof row.active === 'boolean' ? row.active : true,
        createdAt: row.created_at
      }));
    }
    return [];
  }
  const domains = await loadJson(DOMAINS_PATH, []);
  if (domains.length) return domains;
  return [];
}

async function saveDomains(list) {
  if (USE_SUPABASE_STORAGE) {
    const rows = list.map((item) => ({
      name: item.name,
      active: typeof item.active === 'boolean' ? item.active : true,
      created_at: item.createdAt || null
    }));
    await supabaseReplaceAll(SUPABASE_TABLE_DOMAINS, rows, 'name');
    return;
  }
  await saveJson(DOMAINS_PATH, list);
}

async function loadLogs() {
  if (USE_SUPABASE_STORAGE) {
    const data = await supabaseSelectAll(SUPABASE_TABLE_LOGS, 'last_seen_at');
    if (!data) return [];
    return data.map((row) => ({
      id: row.id,
      alias: row.alias,
      from: row.from ?? row.from_email ?? '',
      subject: row.subject,
      date: row.date,
      snippet: row.snippet,
      lastSeenAt: row.last_seen_at
    }));
  }
  return loadJson(LOGS_PATH, []);
}

async function saveLogs(list) {
  if (USE_SUPABASE_STORAGE) {
    const rows = list.map((item) => ({
      id: item.id,
      alias: item.alias || null,
      from_email: item.from || null,
      subject: item.subject || '',
      date: item.date || '',
      snippet: item.snippet || '',
      last_seen_at: item.lastSeenAt || null
    }));
    await supabaseReplaceAll(SUPABASE_TABLE_LOGS, rows, 'id');
    return;
  }
  await saveJson(LOGS_PATH, list);
}

async function loadAudit() {
  if (USE_SUPABASE_STORAGE) {
    const data = await supabaseSelectAll(SUPABASE_TABLE_AUDIT, 'timestamp');
    if (!data) return [];
    return data.map((row) => ({
      timestamp: row.timestamp,
      action: row.action,
      ip: row.ip || null,
      userAgent: row.user_agent || null,
      ...(row.meta || {})
    }));
  }
  return loadJson(AUDIT_PATH, []);
}

async function saveAudit(list) {
  if (USE_SUPABASE_STORAGE) {
    const rows = list.map((item) => ({
      timestamp: item.timestamp || new Date().toISOString(),
      action: item.action || 'unknown',
      ip: item.ip || null,
      user_agent: item.userAgent || null,
      meta: item
    }));
    await supabaseReplaceAll(SUPABASE_TABLE_AUDIT, rows, 'timestamp');
    return;
  }
  await saveJson(AUDIT_PATH, list);
}

// ========== VALIDATION ==========
const emailSchema = z
  .string()
  .email()
  .max(254)
  .refine((email) => {
    const [local, domain] = email.split('@');
    return local && local.length <= 64 && domain && domain.length <= 190;
  });

const domainSchema = z
  .string()
  .regex(/^[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/)
  .max(190);

function isValidEmail(address) {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim().toLowerCase();
  return emailSchema.safeParse(trimmed).success;
}

const PARTNER_ALLOWED_SCOPES = new Set(['alias:create', 'messages:read', 'otp:read']);
const PARTNER_DEFAULT_SCOPES = ['alias:create', 'messages:read', 'otp:read'];
const PARTNER_ACCESS_LOG_LIMIT = 10000;
const PARTNER_RATE_WINDOW_MS = 60 * 1000;
const partnerRateLimitMap = new Map();

function normalizeStringList(raw, { lowercase = true, max = 50 } = {}) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach((entry) => {
    const text = String(entry || '').trim();
    if (!text) return;
    const value = lowercase ? text.toLowerCase() : text;
    if (seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out.slice(0, max);
}

function normalizePartnerScopes(raw) {
  const source = normalizeStringList(raw, { lowercase: true, max: 10 });
  const valid = source.filter((scope) => PARTNER_ALLOWED_SCOPES.has(scope));
  return valid.length ? valid : [...PARTNER_DEFAULT_SCOPES];
}

function normalizePartnerDomainList(raw) {
  const source = normalizeStringList(raw, { lowercase: true, max: 20 });
  return source.filter((domain) => domainSchema.safeParse(domain).success);
}

function normalizePartnerIpList(raw) {
  const source = normalizeStringList(raw, { lowercase: false, max: 50 });
  return source.filter((ip) => ip.length <= 64);
}

function normalizePartnerApiKeyRecord(raw = {}) {
  return {
    id: String(raw.id || '').trim(),
    name: String(raw.name || '').trim() || 'Partner Key',
    keyPrefix: String(raw.keyPrefix || '').trim(),
    keyHash: String(raw.keyHash || '').trim(),
    scopes: normalizePartnerScopes(raw.scopes),
    rateLimitPerMin: Math.min(
      Math.max(parseInt(raw.rateLimitPerMin || PARTNER_DEFAULT_RATE_LIMIT, 10) || PARTNER_DEFAULT_RATE_LIMIT, 1),
      2000
    ),
    allowedIps: normalizePartnerIpList(raw.allowedIps),
    allowedDomains: normalizePartnerDomainList(raw.allowedDomains),
    expiresAt: raw.expiresAt || null,
    revokedAt: raw.revokedAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    lastUsedAt: raw.lastUsedAt || null
  };
}

function normalizePartnerAliasRecord(raw = {}) {
  return {
    alias: String(raw.alias || '').trim().toLowerCase(),
    keyId: String(raw.keyId || '').trim(),
    externalRef: String(raw.externalRef || '').trim() || null,
    createdAt: raw.createdAt || null,
    expiresAt: raw.expiresAt || null,
    lastAccessedAt: raw.lastAccessedAt || null
  };
}

function hashPartnerApiKey(rawKey) {
  return crypto
    .createHash('sha256')
    .update(`${PARTNER_KEY_PEPPER}:${String(rawKey || '')}`)
    .digest('hex');
}

function constantTimeEqualHex(hexA, hexB) {
  if (typeof hexA !== 'string' || typeof hexB !== 'string') return false;
  if (hexA.length !== hexB.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(hexA, 'hex'), Buffer.from(hexB, 'hex'));
  } catch {
    return false;
  }
}

function generatePartnerApiKeyRaw() {
  return `tpk_${crypto.randomBytes(24).toString('hex')}`;
}

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '';
}

async function loadApiKeys() {
  if (USE_SUPABASE_STORAGE) {
    const data = await supabaseSelectAll(SUPABASE_TABLE_API_KEYS, 'created_at');
    if (!data) return [];
    return data.map((row) =>
      normalizePartnerApiKeyRecord({
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        keyHash: row.key_hash,
        scopes: row.scopes,
        rateLimitPerMin: row.rate_limit_per_min,
        allowedIps: row.allowed_ips,
        allowedDomains: row.allowed_domains,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at
      })
    );
  }
  const list = await loadJson(API_KEYS_PATH, []);
  return list.map((item) => normalizePartnerApiKeyRecord(item));
}

async function saveApiKeys(list) {
  const normalized = list.map((item) => normalizePartnerApiKeyRecord(item));
  if (USE_SUPABASE_STORAGE) {
    const rows = normalized.map((item) => ({
      id: item.id,
      name: item.name,
      key_prefix: item.keyPrefix,
      key_hash: item.keyHash,
      scopes: item.scopes,
      rate_limit_per_min: item.rateLimitPerMin,
      allowed_ips: item.allowedIps,
      allowed_domains: item.allowedDomains,
      expires_at: item.expiresAt,
      revoked_at: item.revokedAt,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      last_used_at: item.lastUsedAt
    }));
    await supabaseReplaceAll(SUPABASE_TABLE_API_KEYS, rows, 'id');
    return;
  }
  await saveJson(API_KEYS_PATH, normalized);
}

async function loadPartnerAliases() {
  if (USE_SUPABASE_STORAGE) {
    const data = await supabaseSelectAll(SUPABASE_TABLE_PARTNER_ALIASES, 'created_at');
    if (!data) return [];
    return data.map((row) =>
      normalizePartnerAliasRecord({
        alias: row.alias,
        keyId: row.key_id,
        externalRef: row.external_ref,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        lastAccessedAt: row.last_accessed_at
      })
    );
  }
  const list = await loadJson(PARTNER_ALIASES_PATH, []);
  return list.map((item) => normalizePartnerAliasRecord(item));
}

async function savePartnerAliases(list) {
  const normalized = list.map((item) => normalizePartnerAliasRecord(item));
  if (USE_SUPABASE_STORAGE) {
    const rows = normalized.map((item) => ({
      alias: item.alias,
      key_id: item.keyId,
      external_ref: item.externalRef,
      created_at: item.createdAt,
      expires_at: item.expiresAt,
      last_accessed_at: item.lastAccessedAt
    }));
    await supabaseReplaceAll(SUPABASE_TABLE_PARTNER_ALIASES, rows, 'alias');
    return;
  }
  await saveJson(PARTNER_ALIASES_PATH, normalized);
}

async function appendPartnerAccessLog(entry = {}) {
  const payload = {
    timestamp: entry.timestamp || new Date().toISOString(),
    keyId: entry.keyId || null,
    alias: entry.alias || null,
    route: String(entry.route || 'unknown'),
    status: parseInt(entry.status || 0, 10) || 0,
    ip: entry.ip || null,
    meta: entry.meta || {}
  };

  if (USE_SUPABASE_STORAGE) {
    await supabaseInsert(SUPABASE_TABLE_PARTNER_ACCESS_LOGS, {
      timestamp: payload.timestamp,
      key_id: payload.keyId,
      alias: payload.alias,
      route: payload.route,
      status: payload.status,
      ip: payload.ip,
      meta: payload.meta
    });
    await supabaseTrimPartnerAccessLogs(PARTNER_ACCESS_LOG_LIMIT);
    return;
  }

  const logs = await loadJson(PARTNER_ACCESS_LOGS_PATH, []);
  logs.push(payload);
  if (logs.length > PARTNER_ACCESS_LOG_LIMIT) {
    logs.splice(0, logs.length - PARTNER_ACCESS_LOG_LIMIT);
  }
  await saveJson(PARTNER_ACCESS_LOGS_PATH, logs);
}

function hasPartnerScope(key, requiredScope) {
  if (!requiredScope) return true;
  const scopes = Array.isArray(key?.scopes) ? key.scopes : [];
  return scopes.includes(requiredScope);
}

function isKeyExpired(expiresAt) {
  if (!expiresAt) return false;
  const ts = new Date(expiresAt).getTime();
  return Number.isFinite(ts) && ts <= Date.now();
}

function isKeyActive(key) {
  if (!key || !key.id || !key.keyHash) return false;
  if (key.revokedAt) return false;
  if (isKeyExpired(key.expiresAt)) return false;
  return true;
}

function enforcePartnerRateLimit(keyId, perMinute) {
  const limit = Math.min(Math.max(parseInt(perMinute || PARTNER_DEFAULT_RATE_LIMIT, 10) || PARTNER_DEFAULT_RATE_LIMIT, 1), 5000);
  const now = Date.now();
  const current = partnerRateLimitMap.get(keyId);
  if (!current || now >= current.windowEndsAt) {
    partnerRateLimitMap.set(keyId, {
      count: 1,
      limit,
      windowEndsAt: now + PARTNER_RATE_WINDOW_MS
    });
    return;
  }

  if (current.count >= current.limit) {
    throw new HttpError(429, 'Rate limit exceeded for API key');
  }
  current.count += 1;
}

async function findPartnerKeyByRawValue(rawKey) {
  const hash = hashPartnerApiKey(rawKey);
  const keys = await loadApiKeys();
  return keys.find((item) => constantTimeEqualHex(item.keyHash, hash)) || null;
}

async function touchPartnerKeyUsage(keyId) {
  const now = new Date().toISOString();
  if (USE_SUPABASE_STORAGE) {
    const client = getSupabaseAdmin();
    if (!client) return;
    await client
      .from(SUPABASE_TABLE_API_KEYS)
      .update({ last_used_at: now, updated_at: now })
      .eq('id', keyId);
    return;
  }

  const keys = await loadApiKeys();
  const target = keys.find((item) => item.id === keyId);
  if (!target) return;
  target.lastUsedAt = now;
  target.updatedAt = now;
  await saveApiKeys(keys);
}

function sanitizeApiKeyForAdmin(key) {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    rateLimitPerMin: key.rateLimitPerMin,
    allowedIps: key.allowedIps,
    allowedDomains: key.allowedDomains,
    expiresAt: key.expiresAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
    lastUsedAt: key.lastUsedAt,
    active: isKeyActive(key)
  };
}

async function requirePartnerKey(request, requiredScope = '') {
  if (!PARTNER_API_ENABLED) {
    throw new HttpError(503, 'Partner API is disabled');
  }

  const rawKey = String(request.headers.get('x-api-key') || '').trim();
  if (!rawKey) {
    throw new HttpError(401, 'Missing API key');
  }

  const key = await findPartnerKeyByRawValue(rawKey);
  if (!key || !isKeyActive(key)) {
    throw new HttpError(401, 'Invalid API key');
  }

  if (!hasPartnerScope(key, requiredScope)) {
    throw new HttpError(403, 'API key does not have required scope');
  }

  const ip = getClientIp(request);
  if (key.allowedIps.length > 0) {
    if (!ip || !key.allowedIps.includes(ip)) {
      throw new HttpError(403, 'IP not allowed for this API key');
    }
  }

  enforcePartnerRateLimit(key.id, key.rateLimitPerMin);
  await touchPartnerKeyUsage(key.id);
  return { key, ip };
}

async function assertPartnerAliasOwnership(alias, keyId) {
  const normalizedAlias = String(alias || '').trim().toLowerCase();
  if (!isValidEmail(normalizedAlias)) {
    throw new HttpError(400, 'Invalid alias address');
  }

  const bindings = await loadPartnerAliases();
  const binding = bindings.find((row) => row.alias === normalizedAlias);
  if (!binding || binding.keyId !== keyId) {
    throw new HttpError(403, 'Alias does not belong to this API key');
  }
  if (binding.expiresAt && new Date(binding.expiresAt).getTime() <= Date.now()) {
    throw new HttpError(410, 'Alias has expired');
  }
  return binding;
}

async function touchPartnerAlias(alias, keyId) {
  const bindings = await loadPartnerAliases();
  const target = bindings.find(
    (row) => row.alias === String(alias || '').trim().toLowerCase() && row.keyId === keyId
  );
  if (!target) return;
  target.lastAccessedAt = new Date().toISOString();
  await savePartnerAliases(bindings);
}

const otpKeywordRe = /(otp|passcode|pass code|verification|verify|one[\s-]*time|2fa|mfa|auth|authentication|security code|login code|reset code|activation code|kode|kode verifikasi|kode otp|pin|token)/i;

function normalizeOtpCandidate(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  return text.replace(/[^a-zA-Z0-9]/g, '');
}

function formatOtpCandidate(raw) {
  return String(raw || '')
    .trim()
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .replace(/\s+/g, '-')
    .toUpperCase();
}

function scoreOtpCandidate({ code, idx, raw, input, seedScore = 0 }) {
  let score = seedScore;
  const len = code.length;
  const isNumeric = /^\d+$/.test(code);
  const hasLetter = /[a-zA-Z]/.test(code);
  const hasDigit = /\d/.test(code);
  const digitCount = (code.match(/\d/g) || []).length;

  if (!hasDigit) return -999;

  if (len === 6) score += 7;
  else if (len === 5 || len === 7) score += 5;
  else if (len === 4 || len === 8) score += 3;
  else score += 1;

  if (isNumeric) score += 2;
  if (hasLetter && hasDigit) score += 3;
  if (/^[A-Za-z0-9]{2,8}(?:-[A-Za-z0-9]{2,8}){1,2}$/.test(raw)) score += 6;
  if (/^\d{2,4}(?:[\s-]\d{2,4}){1,3}$/.test(raw)) score += 5;
  if (hasLetter && hasDigit && digitCount === 1 && len >= 8) score -= 8;
  if (hasLetter && !/[A-Z]/.test(raw)) score -= 2;
  if (/^(?:19|20)\d{2}$/.test(code)) score -= 6;
  if (/^(\d)\1{4,}$/.test(code)) score -= 4;
  if (/^\d{9,}$/.test(code)) score -= 5;

  const near = input.slice(Math.max(0, idx - 80), Math.min(input.length, idx + raw.length + 80));
  if (otpKeywordRe.test(near)) score += 10;
  if (/(do not share|jangan bagikan|expires?|expired|berlaku|valid|minutes?|menit)/i.test(near)) score += 2;
  if (/(invoice|order|amount|harga|total|rp\b|idr\b|usd\b)/i.test(near) && !otpKeywordRe.test(near)) score -= 3;

  return score;
}

function pickOtpFromText(text) {
  const input = String(text || '');
  if (!input) return null;

  const candidates = [];
  const seen = new Set();

  function pushCandidate(raw, idx, seedScore = 0) {
    const code = normalizeOtpCandidate(raw);
    const output = formatOtpCandidate(raw);
    if (!code || code.length < 4 || code.length > 12) return;
    if (!/\d/.test(code)) return;
    if ((String(raw).match(/[\s-]/g) || []).length > 3) return;

    const key = `${code}:${idx}`;
    if (seen.has(key)) return;
    seen.add(key);

    const score = scoreOtpCandidate({ code, idx, raw: String(raw || ''), input, seedScore });
    if (score <= 0) return;
    candidates.push({ output, score, idx });
  }

  const contextualRe = /\b(?:otp|passcode|verification(?:\s*code)?|security\s*code|one[\s-]*time(?:\s*(?:password|pin|code))?|kode(?:\s*(?:otp|verifikasi|login))?|pin|token|2fa|mfa|auth(?:entication)?\s*code|confirmation\s*code)\b[^\r\nA-Za-z0-9]{0,20}([A-Za-z0-9]{2,8}(?:[\s-][A-Za-z0-9]{2,8}){0,2})/gi;
  const numericRe = /\b\d{4,8}\b/g;
  const groupedNumericRe = /\b\d{2,4}(?:[\s-]\d{2,4}){1,3}\b/g;
  const groupedAlphaNumRe = /\b[A-Za-z0-9]{2,8}(?:-[A-Za-z0-9]{2,8}){1,2}\b/g;

  let m;
  while ((m = contextualRe.exec(input)) !== null) pushCandidate(m[1], m.index, 9);
  while ((m = groupedNumericRe.exec(input)) !== null) pushCandidate(m[0], m.index, 6);
  while ((m = groupedAlphaNumRe.exec(input)) !== null) pushCandidate(m[0], m.index, 7);
  while ((m = numericRe.exec(input)) !== null) pushCandidate(m[0], m.index, 4);

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return candidates[0].output;
}

function stripHtmlTags(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFilterTerms(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const values = [];
  raw.forEach((entry) => {
    const text = String(entry || '').trim().toLowerCase();
    if (!text || seen.has(text)) return;
    seen.add(text);
    values.push(text);
  });
  return values.slice(0, 20);
}

function normalizeAliasFilterConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const normalized = {
    subjectExact: normalizeFilterTerms(source.subjectExact),
    subjectIncludes: normalizeFilterTerms(source.subjectIncludes),
    subjectExcludes: normalizeFilterTerms(source.subjectExcludes),
    senderIncludes: normalizeFilterTerms(source.senderIncludes),
    keywordIncludes: normalizeFilterTerms(source.keywordIncludes),
    customRegex: String(source.customRegex || '').trim()
  };

  if (normalized.customRegex) {
    try {
      // eslint-disable-next-line no-new
      new RegExp(normalized.customRegex, 'i');
    } catch {
      normalized.customRegex = '';
    }
  }

  return normalized;
}

function hasAliasFilter(config = {}) {
  return Boolean(
    (config.subjectExact && config.subjectExact.length) ||
    (config.subjectIncludes && config.subjectIncludes.length) ||
      (config.subjectExcludes && config.subjectExcludes.length) ||
      (config.senderIncludes && config.senderIncludes.length) ||
      (config.keywordIncludes && config.keywordIncludes.length) ||
      config.customRegex
  );
}

function applyAliasMessageFilter(messages, filterConfig = {}) {
  const normalized = normalizeAliasFilterConfig(filterConfig);
  if (!hasAliasFilter(normalized)) return messages;

  let regex = null;
  if (normalized.customRegex) {
    try {
      regex = new RegExp(normalized.customRegex, 'i');
    } catch {
      regex = null;
    }
  }

  return messages.filter((msg) => {
    const subject = String(msg?.subject || '').toLowerCase();
    const from = String(msg?.from || '').toLowerCase();
    const snippet = String(msg?.snippet || '').toLowerCase();
    const to = String(msg?.to || '').toLowerCase();
    const haystack = `${subject}\n${from}\n${snippet}\n${to}`;

    if (normalized.subjectExact.length > 0) {
      const ok = normalized.subjectExact.some((term) => subject === term);
      if (!ok) return false;
    }

    if (normalized.subjectIncludes.length > 0) {
      const ok = normalized.subjectIncludes.some((term) => subject.includes(term));
      if (!ok) return false;
    }

    if (normalized.subjectExcludes.length > 0) {
      const blocked = normalized.subjectExcludes.some((term) => subject.includes(term));
      if (blocked) return false;
    }

    if (normalized.senderIncludes.length > 0) {
      const ok = normalized.senderIncludes.some((term) => from.includes(term));
      if (!ok) return false;
    }

    if (normalized.keywordIncludes.length > 0) {
      const ok = normalized.keywordIncludes.some((term) => haystack.includes(term));
      if (!ok) return false;
    }

    if (regex && !regex.test(`${msg?.subject || ''}\n${msg?.from || ''}\n${msg?.snippet || ''}\n${msg?.to || ''}`)) {
      return false;
    }

    return true;
  });
}

async function isAllowedDomain(domain) {
  const domains = await loadDomains();
  return domains.find((d) => d.name === domain && d.active !== false);
}

async function auditLog(action, reqMeta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...reqMeta
  };
  if (USE_SUPABASE_STORAGE) {
    const { ip, userAgent, ...meta } = reqMeta || {};
    await supabaseInsert(SUPABASE_TABLE_AUDIT, {
      timestamp: entry.timestamp,
      action,
      ip: ip || null,
      user_agent: userAgent || null,
      meta
    });
    await supabaseTrimAudit(1000);
    log('info', 'Audit log', entry);
    return;
  }
  const audits = await loadAudit();
  audits.push(entry);
  const MAX_AUDIT = 1000;
  if (audits.length > MAX_AUDIT) audits.splice(0, audits.length - MAX_AUDIT);
  await saveAudit(audits);
  log('info', 'Audit log', entry);
}

// ========== CACHE ==========
const messageCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet(key) {
  const entry = messageCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    messageCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttl = CACHE_TTL_MS) {
  messageCache.set(key, { value, expiresAt: Date.now() + ttl });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of messageCache.entries()) {
    if (entry.expiresAt < now) messageCache.delete(key);
  }
}, CACHE_TTL_MS).unref();

// ========== OAUTH STATE ==========
const AUTH_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const AUTH_STATE_TTL_MS = 10 * 60 * 1000;
const pendingStates = new Map();

function createState() {
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, Date.now() + AUTH_STATE_TTL_MS);
  return state;
}

function consumeState(state) {
  const expiresAt = pendingStates.get(state);
  if (!expiresAt) return false;
  pendingStates.delete(state);
  return expiresAt >= Date.now();
}

setInterval(() => {
  const now = Date.now();
  for (const [state, exp] of pendingStates.entries()) {
    if (exp < now) pendingStates.delete(state);
  }
}, AUTH_STATE_TTL_MS).unref();

// ========== OAUTH CLIENT ==========
let oauthClientSingleton = null;

async function tokenExists() {
  if (USE_SUPABASE_STORAGE) {
    const key = getStorageKey(TOKEN_PATH);
    const value = await supabaseGet(key);
    return value != null;
  }
  return fileExists(TOKEN_PATH);
}

async function getOAuthClient() {
  if (oauthClientSingleton) return oauthClientSingleton;
  const client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  if (await tokenExists()) {
    try {
      const saved = await loadJson(TOKEN_PATH, null);
      if (saved) {
        client.setCredentials(saved);
        log('info', 'Loaded saved token');
      }
    } catch (e) {
      log('error', 'Failed to parse token file', { error: e.message });
    }
  }

  client.on('tokens', async (tokens) => {
    let current = {};
    if (await tokenExists()) {
      try {
        current = await loadJson(TOKEN_PATH, {});
      } catch (e) {
        log('error', 'Failed reading token on refresh', { error: e.message });
      }
    }
    const updated = { ...current, ...tokens };
    await saveJson(TOKEN_PATH, updated);
    log('info', 'Token refreshed and saved');
  });

  oauthClientSingleton = client;
  return client;
}

async function ensureToken() {
  if (!(await tokenExists())) {
    throw new HttpError(401, 'Not authenticated');
  }
  try {
    const tokens = await loadJson(TOKEN_PATH, null);
    if (!tokens) throw new Error('Invalid token content');
    const client = await getOAuthClient();
    client.setCredentials(tokens);
    return client;
  } catch (e) {
    log('error', 'Failed to read token', { error: e.message });
    throw new HttpError(500, 'Token file invalid');
  }
}

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (token) {
    const client = getSupabaseAdmin();
    if (!client) {
      throw new HttpError(500, 'Supabase admin client not configured');
    }
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      throw new HttpError(401, 'Unauthorized');
    }
    const email = (data.user.email || '').toLowerCase();
    if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) {
      throw new HttpError(403, 'Forbidden');
    }
    return;
  }

  const key = request.headers.get('x-admin-key');
  if (env.ADMIN_API_KEY && key && key === env.ADMIN_API_KEY) {
    return;
  }

  throw new HttpError(401, 'Unauthorized');
}

function decodeBase64Url(str = '') {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function extractBody(payload) {
  let bodyHtml = '';
  let bodyText = '';

  function traverse(part) {
    if (!part) return;
    const data = part.body?.data ? decodeBase64Url(part.body.data) : '';
    if (part.mimeType === 'text/html') bodyHtml += data;
    if (part.mimeType === 'text/plain') bodyText += data;
    if (part.parts) part.parts.forEach(traverse);
  }

  traverse(payload);
  return { bodyHtml, bodyText };
}

async function touchLogs(msgs, alias) {
  if (!msgs || !msgs.length) return;
  const now = new Date().toISOString();
  const logs = await loadLogs();
  const indexById = new Map();
  logs.forEach((l, i) => indexById.set(l.id, i));

  msgs.forEach((m) => {
    const idx = indexById.get(m.id);
    if (idx != null) {
      logs[idx].lastSeenAt = now;
      logs[idx].alias = alias || logs[idx].alias || null;
    } else {
      logs.push({
        id: m.id,
        alias: alias || null,
        from: m.from || '',
        subject: m.subject || '',
        date: m.date || '',
        snippet: m.snippet || '',
        lastSeenAt: now
      });
    }
  });

  if (logs.length > MAX_LOGS) {
    logs.sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
    logs.length = MAX_LOGS;
  }

  await saveLogs(logs);
}

// ========== SERVICE METHODS ==========
async function generateAuthUrl() {
  const state = createState();
  const client = await getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: AUTH_SCOPES,
    prompt: 'consent',
    state
  });
  return { url, state, expiresInMs: AUTH_STATE_TTL_MS };
}

async function exchangeCode(code, state) {
  if (!code) throw new HttpError(400, 'No code provided');
  if (!state) {
    throw new HttpError(400, 'Missing OAuth state');
  }
  if (!consumeState(state)) {
    throw new HttpError(400, 'Invalid or expired OAuth state');
  }
  try {
    const client = await getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    await saveJson(TOKEN_PATH, tokens);
    log('info', 'Token obtained and saved successfully');
    return { ok: true };
  } catch (err) {
    log('error', 'Failed to get tokens', { error: err.message });
    throw new HttpError(500, 'Failed to get tokens');
  }
}

async function revokeToken() {
  if (!(await tokenExists())) {
    throw new HttpError(404, 'No token to revoke');
  }
  try {
    const client = await getOAuthClient();
    await client.revokeCredentials();
    if (!USE_SUPABASE_STORAGE) {
      await fsPromises.unlink(TOKEN_PATH);
    } else {
      await supabaseSet(getStorageKey(TOKEN_PATH), null);
    }
    await auditLog('token_revoked');
    return { ok: true };
  } catch (err) {
    log('error', 'Failed to revoke token', { error: err.message });
    throw new HttpError(500, 'Failed to revoke token');
  }
}

async function health() {
  return {
    ok: true,
    hasToken: await tokenExists(),
    allowedOrigins: ALLOWED_ORIGINS,
    maxMessages: MAX_MESSAGES,
    cacheSize: messageCache.size
  };
}

async function tokenHealth() {
  const client = await ensureToken();
  const gmail = google.gmail({ version: 'v1', auth: client });
  const start = Date.now();
  await gmail.users.getProfile({ userId: 'me' });
  return { ok: true, tokenValid: true, latencyMs: Date.now() - start };
}

async function listMessages(alias, options = {}) {
  const { bypassFilter = false } = options || {};
  const client = await ensureToken();
  const gmail = google.gmail({ version: 'v1', auth: client });
  const trimmedAlias = (alias || '').trim().toLowerCase();

  const listOptions = {
    userId: 'me',
    maxResults: MAX_MESSAGES
  };

  if (trimmedAlias) {
    if (!isValidEmail(trimmedAlias)) throw new HttpError(400, 'Invalid alias address');
    const domain = trimmedAlias.split('@')[1];
    if (!(await isAllowedDomain(domain))) throw new HttpError(400, 'Domain not allowed');
    // Cloudflare Email Routing forwards to a destination Gmail address.
    // Depending on provider, the original alias may not be searchable via Gmail operators.
    // Strategy: list recent messages and filter by headers (Delivered-To/X-Original-To/To/Cc/Bcc).
    listOptions.q = 'newer_than:7d';
    // Don't hard-filter to INBOX; forwarded mail may be archived/spam.
    listOptions.includeSpamTrash = true;

    const now = new Date().toISOString();
    const aliases = await loadAliases();
    const found = aliases.find((a) => a.address === trimmedAlias);
    if (found) {
      if (found.active === false) throw new HttpError(403, 'Alias is archived');
      found.lastUsedAt = now;
      found.hits = (found.hits || 0) + 1;
      await saveAliases(aliases);
    }
  } else {
    // Default view: latest inbox messages
    listOptions.labelIds = ['INBOX'];
  }

  const listRes = await gmail.users.messages.list(listOptions);
  const messages = listRes.data.messages || [];

  const results = (await Promise.all(
    messages.map(async (msg) => {
      const cacheKey = trimmedAlias ? `msg:${msg.id}:${trimmedAlias}` : `msg:${msg.id}`;
      const cached = cacheGet(cacheKey);
      if (cached) return cached;

      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date', 'To', 'Cc', 'Bcc', 'Delivered-To', 'X-Original-To']
      });

      const headers = msgRes.data.payload.headers || [];
      const getHeader = (name) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const result = {
        id: msg.id,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        date: getHeader('Date'),
        snippet: msgRes.data.snippet || ''
      };

      if (trimmedAlias) {
        const recipientHaystack = [
          getHeader('To'),
          getHeader('Cc'),
          getHeader('Bcc'),
          getHeader('Delivered-To'),
          getHeader('X-Original-To')
        ]
          .join(' ')
          .toLowerCase();

        if (!recipientHaystack.includes(trimmedAlias)) {
          return null;
        }
      }

      cacheSet(cacheKey, result);
      return result;
    })
  ))
    .filter(Boolean);

  let filteredResults = results;
  let appliedFilter = null;
  if (trimmedAlias) {
    const aliases = await loadAliases();
    const found = aliases.find((a) => a.address === trimmedAlias);
    const filterConfig = normalizeAliasFilterConfig(found?.filterConfig || {});
    if (!bypassFilter && hasAliasFilter(filterConfig)) {
      filteredResults = applyAliasMessageFilter(results, filterConfig);
      appliedFilter = {
        enabled: true,
        subjectExact: filterConfig.subjectExact,
        subjectIncludes: filterConfig.subjectIncludes,
        subjectExcludes: filterConfig.subjectExcludes,
        senderIncludes: filterConfig.senderIncludes,
        keywordIncludes: filterConfig.keywordIncludes,
        hasRegex: Boolean(filterConfig.customRegex)
      };
    }
  }

  await touchLogs(bypassFilter ? results : filteredResults, trimmedAlias || null);
  return {
    messages: bypassFilter ? results : filteredResults,
    filter: appliedFilter
  };
}

async function getMessageDetail(id) {
  if (!id) throw new HttpError(400, 'Missing message id');
  const cached = cacheGet(`detail:${id}`);
  if (cached) return cached;

  const client = await ensureToken();
  const gmail = google.gmail({ version: 'v1', auth: client });
  const msgRes = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full'
  });

  const headers = msgRes.data.payload.headers || [];
  const getHeader = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const { bodyHtml, bodyText } = extractBody(msgRes.data.payload);

  const result = {
    id,
    subject: getHeader('Subject'),
    from: getHeader('From'),
    date: getHeader('Date'),
    snippet: msgRes.data.snippet,
    bodyHtml,
    bodyText
  };

  cacheSet(`detail:${id}`, result);
  return result;
}

async function registerAlias(address, options = {}) {
  const {
    bumpUsage = true,
    replaceFilter = false,
    filterConfig = null,
    activate = true,
    allowCreate = true
  } = options || {};
  const addr = (address || '').trim().toLowerCase();
  if (!isValidEmail(addr)) throw new HttpError(400, 'Invalid address');
  const domain = addr.split('@')[1];
  if (!(await isAllowedDomain(domain))) throw new HttpError(400, 'Domain not allowed');

  const now = new Date().toISOString();
  const aliases = await loadAliases();
  const existing = aliases.find((a) => a.address === addr);
  if (existing) {
    if (bumpUsage) {
      existing.lastUsedAt = now;
      existing.hits = (existing.hits || 0) + 1;
    }
    if (activate) existing.active = true;
    if (replaceFilter) existing.filterConfig = normalizeAliasFilterConfig(filterConfig || {});
  } else {
    if (!allowCreate) throw new HttpError(403, 'Alias is not allowed by admin');
    aliases.push({
      address: addr,
      createdAt: now,
      lastUsedAt: bumpUsage ? now : null,
      hits: bumpUsage ? 1 : 0,
      active: activate !== false,
      filterConfig: normalizeAliasFilterConfig(filterConfig || {})
    });
  }
  await saveAliases(aliases);
  return { ok: true };
}

function buildFutureExpiryFromMinutes(rawMinutes) {
  const parsed = parseInt(rawMinutes, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const safeMinutes = Math.min(Math.max(parsed, 1), 7 * 24 * 60);
  return new Date(Date.now() + safeMinutes * 60 * 1000).toISOString();
}

function parseOptionalExpiry(value) {
  if (value == null || value === '') return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new HttpError(400, 'Invalid expiresAt format');
  }
  if (dt.getTime() <= Date.now()) {
    throw new HttpError(400, 'expiresAt must be in the future');
  }
  return dt.toISOString();
}

function randomAliasLocalPart(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function sanitizeLocalPart(raw) {
  const text = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '');
  return text.slice(0, 48);
}

async function adminListApiKeys() {
  const keys = await loadApiKeys();
  keys.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return {
    partnerApiEnabled: PARTNER_API_ENABLED,
    keys: keys.map((item) => sanitizeApiKeyForAdmin(item))
  };
}

async function adminCreateApiKey(input = {}) {
  const name = String(input?.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');

  const now = new Date().toISOString();
  const rawKey = generatePartnerApiKeyRaw();
  const keyId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
  const record = normalizePartnerApiKeyRecord({
    id: keyId,
    name: name.slice(0, 120),
    keyPrefix: rawKey.slice(0, 16),
    keyHash: hashPartnerApiKey(rawKey),
    scopes: normalizePartnerScopes(input?.scopes),
    rateLimitPerMin:
      Math.min(
        Math.max(parseInt(input?.rateLimitPerMin || PARTNER_DEFAULT_RATE_LIMIT, 10) || PARTNER_DEFAULT_RATE_LIMIT, 1),
        2000
      ),
    allowedIps: normalizePartnerIpList(input?.allowedIps),
    allowedDomains: normalizePartnerDomainList(input?.allowedDomains),
    expiresAt: parseOptionalExpiry(input?.expiresAt),
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null
  });

  const keys = await loadApiKeys();
  keys.push(record);
  await saveApiKeys(keys);

  await auditLog('api_key_created', {
    keyId: record.id,
    name: record.name,
    scopes: record.scopes,
    rateLimitPerMin: record.rateLimitPerMin
  });

  return {
    apiKey: sanitizeApiKeyForAdmin(record),
    secret: rawKey
  };
}

async function adminRevokeApiKey(id) {
  const keyId = String(id || '').trim();
  if (!keyId) throw new HttpError(400, 'Invalid key id');

  const keys = await loadApiKeys();
  const target = keys.find((item) => item.id === keyId);
  if (!target) throw new HttpError(404, 'API key not found');

  if (!target.revokedAt) {
    const now = new Date().toISOString();
    target.revokedAt = now;
    target.updatedAt = now;
    await saveApiKeys(keys);
    await auditLog('api_key_revoked', { keyId: target.id, name: target.name });
  }

  return {
    ok: true,
    apiKey: sanitizeApiKeyForAdmin(target)
  };
}

async function adminRotateApiKey(id) {
  const keyId = String(id || '').trim();
  if (!keyId) throw new HttpError(400, 'Invalid key id');

  const keys = await loadApiKeys();
  const target = keys.find((item) => item.id === keyId);
  if (!target) throw new HttpError(404, 'API key not found');
  if (target.revokedAt) throw new HttpError(400, 'API key already revoked');

  const now = new Date().toISOString();
  target.revokedAt = now;
  target.updatedAt = now;

  const rawKey = generatePartnerApiKeyRaw();
  const newId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
  const rotated = normalizePartnerApiKeyRecord({
    ...target,
    id: newId,
    keyPrefix: rawKey.slice(0, 16),
    keyHash: hashPartnerApiKey(rawKey),
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null
  });

  keys.push(rotated);
  await saveApiKeys(keys);

  await auditLog('api_key_rotated', {
    oldKeyId: target.id,
    newKeyId: rotated.id,
    name: target.name
  });

  return {
    apiKey: sanitizeApiKeyForAdmin(rotated),
    secret: rawKey,
    revokedKeyId: target.id
  };
}

async function partnerCreateAlias(request, input = {}) {
  const { key, ip } = await requirePartnerKey(request, 'alias:create');
  const activeDomains = (await publicDomains()).domains || [];
  if (!activeDomains.length) {
    throw new HttpError(400, 'No active domain is available');
  }

  const bindings = await loadPartnerAliases();
  const requestedAddress = String(input?.address || '').trim().toLowerCase();
  const requestedDomain = String(input?.domain || '').trim().toLowerCase();
  const requestedLocalPart = sanitizeLocalPart(input?.localPart);
  const allowedDomains = key.allowedDomains.length
    ? activeDomains.filter((domain) => key.allowedDomains.includes(domain))
    : activeDomains;
  const fallbackDomain = allowedDomains[0] || activeDomains[0];

  let address = '';
  if (requestedAddress) {
    if (!isValidEmail(requestedAddress)) throw new HttpError(400, 'Invalid address');
    const requestedAddressDomain = requestedAddress.split('@')[1];
    if (activeDomains.includes(requestedAddressDomain)) {
      if (key.allowedDomains.length > 0 && !key.allowedDomains.includes(requestedAddressDomain)) {
        throw new HttpError(403, 'API key does not allow this domain');
      }
      address = requestedAddress;
    } else if (key.allowedDomains.length === 0 && fallbackDomain) {
      const localPart = sanitizeLocalPart(requestedAddress.split('@')[0]);
      address = `${localPart || randomAliasLocalPart(10)}@${fallbackDomain}`;
    } else {
      throw new HttpError(400, 'Domain not allowed');
    }
  } else {
    let domain = requestedDomain || fallbackDomain;
    if (!activeDomains.includes(domain)) {
      if (key.allowedDomains.length === 0 && fallbackDomain) {
        domain = fallbackDomain;
      } else {
        throw new HttpError(400, 'Domain not allowed');
      }
    }
    if (key.allowedDomains.length > 0 && !key.allowedDomains.includes(domain)) {
      throw new HttpError(403, 'API key does not allow this domain');
    }

    const isManualLocalPart = Boolean(requestedLocalPart);
    const maxAttempts = isManualLocalPart ? 1 : 10;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const local = isManualLocalPart ? requestedLocalPart : randomAliasLocalPart(10);
      const candidate = `${local}@${domain}`;
      const occupied = bindings.find(
        (row) => row.alias === candidate && row.keyId !== key.id && !isKeyExpired(row.expiresAt)
      );
      if (!occupied) {
        address = candidate;
        break;
      }
    }
  }

  if (!address) {
    throw new HttpError(409, 'Failed to allocate alias, please retry');
  }

  const domain = address.split('@')[1];
  if (key.allowedDomains.length > 0 && !key.allowedDomains.includes(domain)) {
    throw new HttpError(403, 'API key does not allow this domain');
  }

  const occupiedByOther = bindings.find((row) => row.alias === address && row.keyId !== key.id);
  if (occupiedByOther) {
    throw new HttpError(409, 'Alias already owned by another API key');
  }

  await registerAlias(address, {
    bumpUsage: false,
    activate: true,
    allowCreate: true
  });

  const now = new Date().toISOString();
  const expiresAt = input?.ttlMinutes ? buildFutureExpiryFromMinutes(input.ttlMinutes) : null;
  const reference = String(input?.reference || input?.externalRef || '').trim() || null;

  const existingBinding = bindings.find((row) => row.alias === address && row.keyId === key.id);
  if (existingBinding) {
    existingBinding.expiresAt = expiresAt;
    existingBinding.externalRef = reference;
    existingBinding.lastAccessedAt = now;
  } else {
    bindings.push(
      normalizePartnerAliasRecord({
        alias: address,
        keyId: key.id,
        externalRef: reference,
        createdAt: now,
        expiresAt,
        lastAccessedAt: now
      })
    );
  }

  await savePartnerAliases(bindings);
  await appendPartnerAccessLog({
    keyId: key.id,
    alias: address,
    route: 'partner.aliases.create',
    status: 200,
    ip,
    meta: { reference }
  });

  return {
    ok: true,
    alias: address,
    keyId: key.id,
    reference,
    createdAt: now,
    expiresAt
  };
}

async function partnerListAliasMessages(request, alias, options = {}) {
  const { key, ip } = await requirePartnerKey(request, 'messages:read');
  const normalizedAlias = String(alias || '').trim().toLowerCase();
  if (!normalizedAlias) throw new HttpError(400, 'alias is required');

  await assertPartnerAliasOwnership(normalizedAlias, key.id);
  const payload = await listMessages(normalizedAlias, { bypassFilter: true });
  const requestedLimit = Math.min(
    Math.max(parseInt(options?.limit || MAX_MESSAGES, 10) || MAX_MESSAGES, 1),
    MAX_MESSAGES
  );
  const messages = (payload.messages || []).slice(0, requestedLimit);

  await touchPartnerAlias(normalizedAlias, key.id);
  await appendPartnerAccessLog({
    keyId: key.id,
    alias: normalizedAlias,
    route: 'partner.messages.list',
    status: 200,
    ip,
    meta: { count: messages.length }
  });

  return {
    alias: normalizedAlias,
    count: messages.length,
    messages
  };
}

async function partnerGetAliasMessageDetail(request, alias, messageId) {
  const { key, ip } = await requirePartnerKey(request, 'messages:read');
  const normalizedAlias = String(alias || '').trim().toLowerCase();
  const normalizedMessageId = String(messageId || '').trim();
  if (!normalizedAlias) throw new HttpError(400, 'alias is required');
  if (!normalizedMessageId) throw new HttpError(400, 'message id is required');

  await assertPartnerAliasOwnership(normalizedAlias, key.id);

  const payload = await listMessages(normalizedAlias, { bypassFilter: true });
  const listed = (payload.messages || []).find((msg) => msg.id === normalizedMessageId);
  if (!listed) throw new HttpError(404, 'Message not found for this alias');

  const message = await getMessageDetail(normalizedMessageId);
  await touchPartnerAlias(normalizedAlias, key.id);
  await appendPartnerAccessLog({
    keyId: key.id,
    alias: normalizedAlias,
    route: 'partner.messages.detail',
    status: 200,
    ip,
    meta: { messageId: normalizedMessageId }
  });

  return {
    alias: normalizedAlias,
    message
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findLatestOtpForAlias(alias) {
  const payload = await listMessages(alias, { bypassFilter: true });
  const messages = [...(payload.messages || [])];
  messages.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  for (const msg of messages.slice(0, 8)) {
    const base = [msg.subject || '', msg.snippet || '', msg.from || '', msg.to || ''].join('\n');
    let otp = pickOtpFromText(base);
    if (!otp) {
      const detail = await getMessageDetail(msg.id);
      const deep = [
        detail.subject || '',
        detail.bodyText || '',
        stripHtmlTags(detail.bodyHtml || ''),
        detail.from || ''
      ].join('\n');
      otp = pickOtpFromText(`${base}\n${deep}`);
    }

    if (otp) {
      return {
        found: true,
        otp,
        messageId: msg.id,
        subject: msg.subject || '',
        from: msg.from || '',
        date: msg.date || null
      };
    }
  }

  return { found: false, otp: null };
}

async function partnerGetAliasOtp(request, alias, options = {}) {
  const { key, ip } = await requirePartnerKey(request, 'otp:read');
  const normalizedAlias = String(alias || '').trim().toLowerCase();
  if (!normalizedAlias) throw new HttpError(400, 'alias is required');

  await assertPartnerAliasOwnership(normalizedAlias, key.id);

  const waitSeconds = Math.min(
    Math.max(parseInt(options?.waitSeconds || 0, 10) || 0, 0),
    PARTNER_MAX_WAIT_SECONDS
  );
  const deadline = Date.now() + waitSeconds * 1000;
  let polls = 0;

  while (true) {
    polls += 1;
    const result = await findLatestOtpForAlias(normalizedAlias);
    if (result.found) {
      await touchPartnerAlias(normalizedAlias, key.id);
      await appendPartnerAccessLog({
        keyId: key.id,
        alias: normalizedAlias,
        route: 'partner.otp.get',
        status: 200,
        ip,
        meta: { found: true, polls }
      });
      return {
        alias: normalizedAlias,
        found: true,
        otp: result.otp,
        messageId: result.messageId,
        subject: result.subject,
        from: result.from,
        receivedAt: result.date,
        polls
      };
    }

    if (Date.now() >= deadline || waitSeconds === 0) break;
    await delay(1500);
  }

  await appendPartnerAccessLog({
    keyId: key.id,
    alias: normalizedAlias,
    route: 'partner.otp.get',
    status: 200,
    ip,
    meta: { found: false, polls }
  });

  return {
    alias: normalizedAlias,
    found: false,
    otp: null,
    polls
  };
}

async function partnerHealthStatus(request) {
  const { key, ip } = await requirePartnerKey(request);
  const rateState = partnerRateLimitMap.get(key.id);
  const remaining = rateState ? Math.max(0, (rateState.limit || 0) - (rateState.count || 0)) : key.rateLimitPerMin;

  await appendPartnerAccessLog({
    keyId: key.id,
    alias: null,
    route: 'partner.health',
    status: 200,
    ip,
    meta: { remaining }
  });

  return {
    ok: true,
    partnerApiEnabled: PARTNER_API_ENABLED,
    key: sanitizeApiKeyForAdmin(key),
    rateLimit: {
      limitPerMin: key.rateLimitPerMin,
      remaining,
      resetAt: rateState ? new Date(rateState.windowEndsAt).toISOString() : null
    },
    maxWaitSeconds: PARTNER_MAX_WAIT_SECONDS,
    serverTime: new Date().toISOString()
  };
}

async function adminCreateAlias(input = {}) {
  const address = String(input?.address || '').trim().toLowerCase();
  if (!address) throw new HttpError(400, 'Address is required');
  const filterConfig = normalizeAliasFilterConfig(input?.filterConfig || {});
  await registerAlias(address, {
    bumpUsage: false,
    replaceFilter: true,
    filterConfig,
    activate: true
  });
  await setAliasFilterConfig(address, filterConfig, { clearIfEmpty: true });
  await auditLog('alias_upserted', {
    address,
    hasFilter: hasAliasFilter(filterConfig)
  });
  return { ok: true, address, filterConfig };
}

async function updateAlias(address, input = {}) {
  const addressParam = decodeURIComponent(address || '').toLowerCase();
  const aliases = await loadAliases();
  const target = aliases.find((a) => a.address === addressParam);
  if (!target) throw new HttpError(404, 'Alias not found');

  if (typeof input?.active === 'boolean') target.active = input.active;
  if (Object.prototype.hasOwnProperty.call(input || {}, 'filterConfig')) {
    target.filterConfig = normalizeAliasFilterConfig(input?.filterConfig || {});
    await setAliasFilterConfig(addressParam, target.filterConfig, { clearIfEmpty: true });
  }

  await saveAliases(aliases);
  await auditLog('alias_updated', {
    address: addressParam,
    active: target.active,
    hasFilter: hasAliasFilter(target.filterConfig || {})
  });
  return { ok: true, alias: target };
}

async function adminStats() {
  const aliases = await loadAliases();
  const domains = await loadDomains();
  const total = aliases.length;
  const totalHits = aliases.reduce((sum, a) => sum + (a.hits || 0), 0);
  return {
    totalAliases: total,
    totalHits,
    lastAliasCreatedAt: aliases[total - 1]?.createdAt || null,
    totalDomains: domains.length,
    storage: {
      mode: USE_SUPABASE_STORAGE ? 'supabase' : 'json',
      supabaseUrlHost: SUPABASE_URL ? new URL(SUPABASE_URL).host : null,
      instanceId: MODULE_INSTANCE_ID,
      tables: {
        kv: SUPABASE_KV_TABLE,
        aliases: SUPABASE_TABLE_ALIASES,
        domains: SUPABASE_TABLE_DOMAINS,
        logs: SUPABASE_TABLE_LOGS,
        audit: SUPABASE_TABLE_AUDIT,
        apiKeys: SUPABASE_TABLE_API_KEYS,
        partnerAliases: SUPABASE_TABLE_PARTNER_ALIASES,
        partnerAccessLogs: SUPABASE_TABLE_PARTNER_ACCESS_LOGS
      }
    }
  };
}

async function adminAliases() {
  const aliases = await loadAliases();
  return {
    aliases,
    stats: {
      total: aliases.length,
      withFilter: aliases.filter((a) => hasAliasFilter(a.filterConfig || {})).length,
      active: aliases.filter((a) => a.active !== false).length
    },
    storage: {
      mode: USE_SUPABASE_STORAGE ? 'supabase' : 'json',
      supabaseUrlHost: SUPABASE_URL ? new URL(SUPABASE_URL).host : null,
      instanceId: MODULE_INSTANCE_ID,
      tables: {
        aliases: SUPABASE_TABLE_ALIASES
      }
    }
  };
}

async function deleteAlias(address) {
  const addrParam = decodeURIComponent(address || '').toLowerCase();
  const aliases = await loadAliases();
  let changed = 0;
  const now = new Date().toISOString();
  const updated = aliases.map((a) => {
    if (a.address !== addrParam) return a;
    if (a.active === false) return a;
    changed += 1;
    return { ...a, active: false, lastUsedAt: now };
  });
  await saveAliases(updated);
  await auditLog('alias_deleted', { address: addrParam });
  return { removed: changed };
}

async function adminDomains() {
  return {
    domains: await loadDomains(),
    storage: {
      mode: USE_SUPABASE_STORAGE ? 'supabase' : 'json',
      supabaseUrlHost: SUPABASE_URL ? new URL(SUPABASE_URL).host : null,
      instanceId: MODULE_INSTANCE_ID,
      tables: {
        domains: SUPABASE_TABLE_DOMAINS
      }
    }
  };
}

async function publicDomains() {
  const domains = (await loadDomains()).filter((d) => d.active !== false);
  return { domains };
}

async function addDomain(name) {
  const trimmed = (name || '').trim().toLowerCase();
  const validation = domainSchema.safeParse(trimmed);
  if (!validation.success) throw new HttpError(400, 'Invalid domain name');

  const domains = await loadDomains();
  if (domains.find((d) => d.name === trimmed)) throw new HttpError(400, 'Domain already exists');

  const now = new Date().toISOString();
  domains.push({ name: trimmed, active: true, createdAt: now });
  await saveDomains(domains);
  await auditLog('domain_added', { domain: trimmed });
  return { ok: true };
}

async function updateDomain(name, body) {
  const nameParam = decodeURIComponent(name || '').toLowerCase();
  const domains = await loadDomains();
  const target = domains.find((d) => d.name === nameParam);
  if (!target) throw new HttpError(404, 'Domain not found');
  if (typeof body?.active === 'boolean') target.active = body.active;
  await saveDomains(domains);
  return { ok: true, domain: target };
}

async function deleteDomain(name) {
  const nameParam = decodeURIComponent(name || '').toLowerCase();
  const domains = await loadDomains();
  const filtered = domains.filter((d) => d.name !== nameParam);
  await saveDomains(filtered);
  await auditLog('domain_deleted', { domain: nameParam });
  return { removed: domains.length - filtered.length };
}

async function adminLogs(limit, aliasFilter) {
  const normalizedLimit = Math.min(parseInt(limit || '2000', 10) || 2000, MAX_LOGS);
  const filter = (aliasFilter || '').toLowerCase().trim();
  let logs = await loadLogs();
  if (filter) logs = logs.filter((l) => (l.alias || '').toLowerCase() === filter);
  logs.sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
  logs = logs.slice(0, normalizedLimit);
  return {
    logs,
    storage: {
      mode: USE_SUPABASE_STORAGE ? 'supabase' : 'json',
      supabaseUrlHost: SUPABASE_URL ? new URL(SUPABASE_URL).host : null,
      instanceId: MODULE_INSTANCE_ID,
      tables: {
        logs: SUPABASE_TABLE_LOGS
      }
    }
  };
}

async function clearLogs() {
  await auditLog('logs_cleared');
  await saveLogs([]);
  return { cleared: true };
}

async function debugStorage() {
  const supabaseUrlHost = SUPABASE_URL ? new URL(SUPABASE_URL).host : null;
  const serviceRoleClaims = (() => {
    try {
      if (!SUPABASE_SERVICE_ROLE_KEY) return null;
      const parts = String(SUPABASE_SERVICE_ROLE_KEY).split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(decodeBase64Url(parts[1]));
      return {
        ref: payload.ref ?? null,
        role: payload.role ?? null,
        iat: payload.iat ?? null,
        exp: payload.exp ?? null
      };
    } catch {
      return null;
    }
  })();

  if (!USE_SUPABASE_STORAGE) {
    return {
      ok: true,
      instanceId: MODULE_INSTANCE_ID,
      useSupabaseStorage: false,
      supabaseUrlHost,
      serviceRoleClaims,
      tables: {
        kv: SUPABASE_KV_TABLE,
        aliases: SUPABASE_TABLE_ALIASES,
        domains: SUPABASE_TABLE_DOMAINS,
        logs: SUPABASE_TABLE_LOGS,
        audit: SUPABASE_TABLE_AUDIT,
        apiKeys: SUPABASE_TABLE_API_KEYS,
        partnerAliases: SUPABASE_TABLE_PARTNER_ALIASES,
        partnerAccessLogs: SUPABASE_TABLE_PARTNER_ACCESS_LOGS
      },
      computed: {
        loadAliasesCount: (await loadAliases()).length,
        loadDomainsCount: (await loadDomains()).length
      }
    };
  }

  const client = getSupabaseAdmin();
  const result = {
    ok: true,
    instanceId: MODULE_INSTANCE_ID,
    useSupabaseStorage: true,
    supabaseUrlHost,
    serviceRoleClaims,
    supabaseClient: {
      restUrl: client?.rest?.url ?? null
    },
    tables: {
      kv: SUPABASE_KV_TABLE,
      aliases: SUPABASE_TABLE_ALIASES,
      domains: SUPABASE_TABLE_DOMAINS,
      logs: SUPABASE_TABLE_LOGS,
      audit: SUPABASE_TABLE_AUDIT,
      apiKeys: SUPABASE_TABLE_API_KEYS,
      partnerAliases: SUPABASE_TABLE_PARTNER_ALIASES,
      partnerAccessLogs: SUPABASE_TABLE_PARTNER_ACCESS_LOGS
    },
    checks: {
      kv: { ok: false },
      aliases: { ok: false },
      domains: { ok: false }
    },
    computed: {
      loadAliasesCount: null,
      loadAliasesSample: [],
      loadDomainsCount: null,
      loadDomainsSample: [],
      supabaseSelectAll: {
        aliasesLen: null,
        aliasesFirst: null,
        domainsLen: null,
        domainsFirst: null
      }
    }
  };

  {
    const aliases = await loadAliases();
    result.computed.loadAliasesCount = aliases.length;
    result.computed.loadAliasesSample = aliases.slice(0, 3);
  }

  {
    const domains = await loadDomains();
    result.computed.loadDomainsCount = domains.length;
    result.computed.loadDomainsSample = domains.slice(0, 3);
  }

  {
    const rawAliases = await supabaseSelectAll(SUPABASE_TABLE_ALIASES, 'created_at');
    result.computed.supabaseSelectAll.aliasesLen = rawAliases ? rawAliases.length : null;
    result.computed.supabaseSelectAll.aliasesFirst = rawAliases?.[0] ?? null;
  }

  {
    const rawDomains = await supabaseSelectAll(SUPABASE_TABLE_DOMAINS, 'created_at');
    result.computed.supabaseSelectAll.domainsLen = rawDomains ? rawDomains.length : null;
    result.computed.supabaseSelectAll.domainsFirst = rawDomains?.[0] ?? null;
  }

  {
    const { error } = await client.from(SUPABASE_KV_TABLE).select('key').limit(1);
    result.checks.kv.ok = !error;
    result.checks.kv.error = error?.message || null;
  }

  {
    const { data, error } = await client
      .from(SUPABASE_TABLE_ALIASES)
      .select('address,active,created_at,last_used_at,hits')
      .order('created_at', { ascending: false })
      .limit(10);
    result.checks.aliases.ok = !error;
    result.checks.aliases.error = error?.message || null;
    result.checks.aliases.sample = (data || []).map((r) => ({
      address: r.address,
      active: typeof r.active === 'boolean' ? r.active : null,
      created_at: r.created_at ?? null,
      last_used_at: r.last_used_at ?? null,
      hits: typeof r.hits === 'number' ? r.hits : null
    }));

    const { count, error: countError } = await client
      .from(SUPABASE_TABLE_ALIASES)
      .select('*', { count: 'exact', head: true });
    result.checks.aliases.count = count ?? null;
    result.checks.aliases.countError = countError?.message || null;
  }

  {
    const { data, error } = await client.from(SUPABASE_TABLE_DOMAINS).select('*').limit(10);
    result.checks.domains.ok = !error;
    result.checks.domains.error = error?.message || null;
    result.checks.domains.sample = (data || []).map((r) => ({
      name: r.name,
      active: typeof r.active === 'boolean' ? r.active : null,
      created_at: r.created_at ?? null
    }));

    const { count, error: countError } = await client
      .from(SUPABASE_TABLE_DOMAINS)
      .select('*', { count: 'exact', head: true });
    result.checks.domains.count = count ?? null;
    result.checks.domains.countError = countError?.message || null;
  }

  return result;
}

// ========== UI THEME ==========
const UI_CONFIG_PATH = path.join(DATA_DIR, 'ui-config.json');
const VALID_THEMES = new Set(['blue', 'dark', 'green', 'rose', 'amber']);

async function getUiTheme() {
  try {
    const config = await loadJson(UI_CONFIG_PATH, {});
    const theme = config?.theme;
    return typeof theme === 'string' && VALID_THEMES.has(theme) ? theme : 'blue';
  } catch {
    return 'blue';
  }
}

async function setUiTheme(themeId) {
  const safe = typeof themeId === 'string' && VALID_THEMES.has(themeId) ? themeId : 'blue';
  const config = await loadJson(UI_CONFIG_PATH, {});
  config.theme = safe;
  await saveJson(UI_CONFIG_PATH, config);
  return { ok: true, theme: safe };
}

export {
  HttpError,
  env,
  health,
  tokenHealth,
  generateAuthUrl,
  exchangeCode,
  revokeToken,
  listMessages,
  getMessageDetail,
  registerAlias,
  adminCreateAlias,
  adminListApiKeys,
  adminCreateApiKey,
  adminRevokeApiKey,
  adminRotateApiKey,
  adminStats,
  adminAliases,
  updateAlias,
  deleteAlias,
  adminDomains,
  publicDomains,
  addDomain,
  updateDomain,
  deleteDomain,
  adminLogs,
  clearLogs,
  debugStorage,
  requireAdmin,
  requirePartnerKey,
  partnerCreateAlias,
  partnerListAliasMessages,
  partnerGetAliasMessageDetail,
  partnerGetAliasOtp,
  partnerHealthStatus,
  getUiTheme,
  setUiTheme
};

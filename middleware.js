import { NextResponse } from 'next/server';

/**
 * Next.js Middleware
 * 
 * Handles:
 * 1. CORS preflight for API routes
 * 2. Security headers for all responses
 * 3. Tenant identification from subdomain (passed via x-tenant-id request header)
 */

// Parse allowed origins from env (available at build time or edge runtime)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true; // Same-origin requests don't send Origin header
  if (ALLOWED_ORIGINS.length === 0) return true; // No restriction if not configured
  if (ALLOWED_ORIGINS.includes('*')) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function getCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key, x-api-key, x-tenant-id',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // ── CORS Preflight (OPTIONS) ──────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(origin);
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // ── Tenant Resolution from Subdomain ──────────────────────────────────────
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  // Platforms where the full hostname is NOT a subdomain-based tenant
  // e.g., "my-app.vercel.app" is NOT tenant "my-app", it's just the deployment URL
  const PLATFORM_DOMAINS = ['vercel.app', 'netlify.app', 'railway.app', 'onrender.com'];
  const isPlatformDomain = PLATFORM_DOMAINS.some(d => hostname.endsWith(d));

  // Extract subdomain if present (e.g., "tenant1.tmail.example.com" -> "tenant1")
  // but NOT for platform deployment URLs (xxx.vercel.app, etc.)
  let tenantId = null;
  if (parts.length >= 3 && hostname !== 'localhost' && !isPlatformDomain) {
    const subdomain = parts[0];
    if (subdomain !== 'www' && subdomain !== 'api') {
      tenantId = subdomain;
    }
  }

  // Create response with tenant header passed to downstream via request headers
  const requestHeaders = new Headers(request.headers);
  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // ── Security Headers ──────────────────────────────────────────────────────
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ── CORS Headers on actual responses ──────────────────────────────────────
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/') || pathname === '/login' || pathname === '/oauth2callback') {
    const corsHeaders = getCorsHeaders(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  // ── Cache Control for static-like API responses ───────────────────────────
  if (pathname === '/api/theme') {
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  }

  return response;
}

export const config = {
  // Run middleware on all routes except static files and _next internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

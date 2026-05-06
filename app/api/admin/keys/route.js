import { adminCreateApiKey, adminListApiKeys, requireAdmin, resolveTenantId } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const payload = await adminListApiKeys(tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const body = await request.json().catch(() => ({}));
    const payload = await adminCreateApiKey(body || {}, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

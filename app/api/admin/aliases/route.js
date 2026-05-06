import { adminAliases, adminCreateAlias, requireAdmin, resolveTenantId } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const payload = await adminAliases(tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const body = await request.json();
    const payload = await adminCreateAlias(body || {}, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

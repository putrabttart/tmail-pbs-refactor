import { adminLogs, clearLogs, requireAdmin, resolveTenantId } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const alias = searchParams.get('alias') || '';
    const payload = await adminLogs(limit, alias, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const payload = await clearLogs(tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

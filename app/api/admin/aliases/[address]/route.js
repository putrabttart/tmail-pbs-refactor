import { deleteAlias, requireAdmin, resolveTenantId, updateAlias } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const payload = await deleteAlias(params.address, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request, { params }) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const body = await request.json();
    const payload = await updateAlias(params.address, body || {}, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

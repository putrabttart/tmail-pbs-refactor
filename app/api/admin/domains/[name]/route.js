import { deleteDomain, requireAdmin, resolveTenantId, updateDomain } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const body = await request.json();
    const payload = await updateDomain(params.name, body || {}, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const payload = await deleteDomain(params.name, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

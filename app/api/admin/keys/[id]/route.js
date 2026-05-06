import { adminRevokeApiKey, requireAdmin, resolveTenantId } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const payload = await adminRevokeApiKey(params.id, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

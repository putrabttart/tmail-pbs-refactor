import { adminRotateApiKey, requireAdmin, resolveTenantId } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const payload = await adminRotateApiKey(params.id, tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

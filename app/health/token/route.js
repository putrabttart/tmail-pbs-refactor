import { tokenHealth, resolveTenantId } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    const payload = await tokenHealth(tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

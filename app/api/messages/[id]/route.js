import { getMessageDetail, resolveTenantId } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const tenantId = resolveTenantId(request);
    const payload = await getMessageDetail(params.id);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

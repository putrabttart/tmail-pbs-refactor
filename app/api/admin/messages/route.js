import { listMessages, requireAdmin, resolveTenantId } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const { searchParams } = new URL(request.url);
    const alias = searchParams.get('alias') || '';
    const payload = await listMessages(alias, { bypassFilter: true, tenantId });
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

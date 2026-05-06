import { getUiTheme, setUiTheme, requireAdmin, resolveTenantId } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const theme = await getUiTheme(tenantId);
    return respond({ theme });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const body = await request.json().catch(() => ({}));
    const result = await setUiTheme(String(body?.theme || 'blue').trim(), tenantId);
    return respond(result);
  } catch (err) {
    return handleError(err);
  }
}

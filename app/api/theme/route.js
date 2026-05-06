import { getUiTheme, resolveTenantId } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    const theme = await getUiTheme(tenantId);
    return respond({ theme });
  } catch (err) {
    return handleError(err);
  }
}

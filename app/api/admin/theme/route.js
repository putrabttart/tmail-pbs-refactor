import { getUiTheme, setUiTheme, requireAdmin } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const theme = await getUiTheme();
    return respond({ theme });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const result = await setUiTheme(String(body?.theme || 'blue').trim());
    return respond(result);
  } catch (err) {
    return handleError(err);
  }
}

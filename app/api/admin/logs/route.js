import { adminLogs, clearLogs, requireAdmin } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const alias = searchParams.get('alias') || '';
    const payload = await adminLogs(limit, alias);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request) {
  try {
    await requireAdmin(request);
    const payload = await clearLogs();
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

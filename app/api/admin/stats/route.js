import { adminStats, requireAdmin } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const payload = await adminStats();
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

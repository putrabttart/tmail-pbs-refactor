import { revokeToken, requireAdmin } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await requireAdmin(request);
    const payload = await revokeToken();
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

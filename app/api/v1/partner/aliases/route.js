import { partnerCreateAlias } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = await partnerCreateAlias(request, body || {});
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

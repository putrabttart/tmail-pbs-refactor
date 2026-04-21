import { partnerHealthStatus } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const payload = await partnerHealthStatus(request);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

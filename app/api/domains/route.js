import { publicDomains } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await publicDomains();
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

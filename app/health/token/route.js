import { tokenHealth } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await tokenHealth();
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

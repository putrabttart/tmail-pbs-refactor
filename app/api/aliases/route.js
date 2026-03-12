import { registerAlias } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = await registerAlias(body.address || '');
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

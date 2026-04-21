import { adminRotateApiKey, requireAdmin } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    await requireAdmin(request);
    const payload = await adminRotateApiKey(params.id);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

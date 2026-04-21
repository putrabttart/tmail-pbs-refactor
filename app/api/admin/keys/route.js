import { adminCreateApiKey, adminListApiKeys, requireAdmin } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const payload = await adminListApiKeys();
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const payload = await adminCreateApiKey(body || {});
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

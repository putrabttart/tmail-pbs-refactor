import { adminRevokeApiKey, requireAdmin } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request);
    const payload = await adminRevokeApiKey(params.id);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

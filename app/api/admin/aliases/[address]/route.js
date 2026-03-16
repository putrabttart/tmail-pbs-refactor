import { deleteAlias, requireAdmin, updateAlias } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request);
    const payload = await deleteAlias(params.address);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const payload = await updateAlias(params.address, body || {});
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

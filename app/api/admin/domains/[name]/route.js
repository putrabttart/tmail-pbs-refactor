import { deleteDomain, requireAdmin, updateDomain } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const payload = await updateDomain(params.name, body || {});
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request);
    const payload = await deleteDomain(params.name);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

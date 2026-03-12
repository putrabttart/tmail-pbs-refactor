import { addDomain, adminDomains, requireAdmin } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const payload = await adminDomains();
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const payload = await addDomain(body.name || '');
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

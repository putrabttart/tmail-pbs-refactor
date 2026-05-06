import { addDomain, adminDomains, requireAdmin, resolveTenantId } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const payload = await adminDomains(tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    const tenantId = resolveTenantId(request);
    await requireAdmin(request, tenantId);
    const body = await request.json();
    const payload = await addDomain(body.name || '', tenantId);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

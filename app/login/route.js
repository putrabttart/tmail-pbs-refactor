import { NextResponse } from 'next/server';
import { generateAuthUrl, resolveTenantId } from '@/lib/server/runtime';
import { handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const tenantId = resolveTenantId(request);
    const { url } = await generateAuthUrl(tenantId, request.url);
    return NextResponse.redirect(url);
  } catch (err) {
    return handleError(err);
  }
}

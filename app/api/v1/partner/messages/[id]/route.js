import { partnerGetAliasMessageDetail } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const alias = searchParams.get('alias') || '';
    const payload = await partnerGetAliasMessageDetail(request, alias, params.id);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

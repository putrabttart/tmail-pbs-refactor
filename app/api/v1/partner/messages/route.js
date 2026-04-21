import { partnerListAliasMessages } from '@/lib/server/runtime';
import { handleError, respond } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const alias = searchParams.get('alias') || '';
    const limit = searchParams.get('limit') || '';
    const payload = await partnerListAliasMessages(request, alias, { limit });
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}

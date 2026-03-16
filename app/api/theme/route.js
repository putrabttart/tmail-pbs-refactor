import { getUiTheme } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const theme = await getUiTheme();
    return respond({ theme });
  } catch (err) {
    return handleError(err);
  }
}

import { NextResponse } from 'next/server';
import { generateAuthUrl } from '@/lib/server/runtime';
import { handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { url } = await generateAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    return handleError(err);
  }
}

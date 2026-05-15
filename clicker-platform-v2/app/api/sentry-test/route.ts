import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  throw new Error('Sentry test server-side error');
  return NextResponse.json({ ok: true });
}

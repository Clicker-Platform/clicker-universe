import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { validatePromoCode } from '@/lib/registration/api-server';
import { validatePromoLimiter } from '@/lib/registration/rate-limit';

export const dynamic = 'force-dynamic';

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3013',
  'https://clicker.id',
  'https://www.clicker.id',
  'https://go.clicker.id',
  'https://backyard.clicker.id',
  'https://clickerapps.web.app',
]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!validatePromoLimiter.check(ip)) {
    return NextResponse.json(
      { valid: false, reason: 'Too many requests' },
      { status: 429, headers: corsHeaders(request) }
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code') ?? '';
  if (!code) {
    return NextResponse.json(
      { valid: false, reason: 'Missing code' },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  try {
    const result = await validatePromoCode(code);
    return NextResponse.json(result, { headers: corsHeaders(request) });
  } catch (error) {
    logger.error('registration.validatePromo.failed', { error });
    return NextResponse.json(
      { valid: false, reason: 'Internal error' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

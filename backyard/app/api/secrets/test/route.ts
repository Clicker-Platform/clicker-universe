import { NextRequest, NextResponse } from 'next/server';
import { getSecret, SECRET_KEYS } from '@/lib/secrets';
import type { SecretKey } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

type TestResult = { ok: boolean; message: string };

async function testOpenRouter(key: string): Promise<TestResult> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return { ok: true, message: 'Connected' };
  } catch (e: unknown) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

async function testResend(key: string): Promise<TestResult> {
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return { ok: true, message: 'Connected' };
  } catch (e: unknown) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

const UPSTASH_URL = 'https://viable-mongrel-36791.upstash.io';

async function testUpstash(key: string): Promise<TestResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? UPSTASH_URL;
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return { ok: true, message: 'Connected' };
  } catch (e: unknown) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

function testFormatOnly(key: string, minLength: number): TestResult {
  if (key.length < minLength) return { ok: false, message: `Too short (min ${minLength} chars)` };
  return { ok: true, message: 'Format valid' };
}

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json() as { key: string };

    if (!key || !(key in SECRET_KEYS)) {
      return NextResponse.json({ error: `Unknown secret key: ${key}` }, { status: 400 });
    }

    const value = await getSecret(key as SecretKey);

    let result: TestResult;
    switch (key as SecretKey) {
      case 'OPENROUTER_API_KEY':
        result = await testOpenRouter(value); break;
      case 'RESEND_API_KEY':
        result = await testResend(value); break;
      case 'UPSTASH_REDIS_REST_TOKEN':
        result = await testUpstash(value); break;
      case 'WA_WEBHOOK_VERIFY_TOKEN':
        result = testFormatOnly(value, 8); break;
      case 'META_APP_SECRET':
        result = testFormatOnly(value, 16); break;
      case 'WA_ENCRYPTION_KEY':
        result = testFormatOnly(value, 32); break;
      default:
        result = { ok: true, message: 'Exists' };
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

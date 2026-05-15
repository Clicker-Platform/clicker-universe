import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/secrets';
import { requireSuperadmin } from '@/lib/require-superadmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    let apiKey: string;
    try {
      apiKey = await getSecret('OPENROUTER_API_KEY');
    } catch {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not set' }, { status: 500 });
    }

    const cleanKey = apiKey.trim();
    const headers = { 'Authorization': `Bearer ${cleanKey}` };

    const [keyRes, creditsRes] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/auth/key', { headers }),
      fetch('https://openrouter.ai/api/v1/credits', { headers }),
    ]);

    if (!keyRes.ok) {
      const body = await keyRes.text();
      return NextResponse.json({ error: `OpenRouter HTTP ${keyRes.status}: ${body}` }, { status: 502 });
    }

    const keyData = (await keyRes.json() as { data: {
      label: string;
      usage: number;
      usage_monthly: number;
      limit: number | null;
      limit_remaining: number | null;
      is_free_tier: boolean;
      rate_limit: { requests: number; interval: string };
    } }).data;

    let totalCredits: number | null = null;
    let totalUsage: number | null = null;
    if (creditsRes.ok) {
      const creditsData = (await creditsRes.json() as { data: { total_credits: number; total_usage: number } }).data;
      totalCredits = creditsData.total_credits;
      totalUsage = creditsData.total_usage;
    }

    return NextResponse.json({
      label: keyData.label,
      usage: keyData.usage,
      usageMonthly: keyData.usage_monthly,
      limit: keyData.limit,
      limitRemaining: keyData.limit_remaining,
      isFreeTier: keyData.is_free_tier,
      totalCredits,
      totalUsage,
      balance: totalCredits != null && totalUsage != null ? totalCredits - totalUsage : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

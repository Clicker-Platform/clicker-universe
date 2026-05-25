/**
 * AI credit display helpers.
 *
 * Storage is in raw USD (see lib/ai/credits.ts). Display is in whole "credits"
 * via a single peg below. To re-tune the peg later, change ONLY this constant —
 * no schema migration required.
 *
 * See spec: superpowers/specs/2026-05-23-ai-credit-indicator.md
 */

export const USD_PER_CREDIT = 0.01;

export function usdToCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.round(usd / USD_PER_CREDIT);
}

export function formatCredits(usd: number): string {
  return `${usdToCredits(usd).toLocaleString('en-US')} credits`;
}

export function formatCreditsShort(usd: number): string {
  const n = usdToCredits(usd);
  if (n >= 10_000) {
    const k = n / 1_000;
    // 1 decimal, strip trailing ".0"
    return `${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return n.toLocaleString('en-US');
}

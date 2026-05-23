'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { type CreditState } from '@/lib/hooks/use-ai-credit-status';
import { useAICreditStatusContext } from './AICreditStatusContext';
import { formatCredits } from '@/lib/ai/credits-display';
import { useSite } from '@/lib/site-context';

interface Props {
  variant: 'launcher' | 'popover';
  onNavigate?: () => void;
}

const STATE_CLASSES: Record<CreditState, { card: string; bar: string; foot: string; dot: string }> = {
  healthy: {
    card: 'bg-gray-50 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700',
    bar: 'bg-studio-blue',
    foot: 'text-gray-400 dark:text-neutral-500',
    dot: 'bg-gray-400 dark:bg-neutral-500',
  },
  warn: {
    card: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60',
    bar: 'bg-amber-500',
    foot: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  critical: {
    card: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60',
    bar: 'bg-red-500',
    foot: 'text-red-700 dark:text-red-400 font-semibold',
    dot: 'bg-red-500 animate-pulse',
  },
  out: {
    card: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60',
    bar: 'bg-red-500',
    foot: 'text-red-700 dark:text-red-400 font-semibold',
    dot: 'bg-red-500 animate-pulse',
  },
};

function footerText(state: CreditState): string | null {
  switch (state) {
    case 'healthy': return null;
    case 'warn':    return 'Running low — top up soon';
    case 'critical':return 'Critical — top up now';
    case 'out':     return 'AI features paused — top up to resume';
  }
}

export function AICreditCard({ variant, onNavigate }: Props) {
  const status = useAICreditStatusContext();
  const { tenantSlug, isSubdomain } = useSite();
  if (!status.shouldRender || status.loading) return null;

  const { state, balanceUSD, balanceCredits, pct } = status;
  const cls = STATE_CLASSES[state];

  // Bar fill: pct when known, else min 100% (healthy) / 0% (out) / proportional fallback
  const barPct = pct !== undefined
    ? Math.max(0, Math.min(1, pct)) * 100
    : (state === 'out' ? 0 : state === 'critical' ? 5 : state === 'warn' ? 25 : 100);

  const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';
  const usageHref = `${baseUrl}/admin/ai-usage`;

  const foot = footerText(state);

  const inner = (
    <div className={`block w-full rounded-lg border px-3 py-2.5 transition-colors hover:brightness-[.98] ${cls.card}`}>
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
        <Zap size={11} className="text-studio-blue" />
        AI Credits
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${cls.bar}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {foot ? (
          <div className={`flex items-center gap-1.5 text-[11px] ${cls.foot}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls.dot}`} aria-hidden="true" />
            {foot}
          </div>
        ) : null}
        <div className={`text-[11px] font-semibold text-neutral-800 dark:text-neutral-100 tabular-nums ${foot ? 'ml-auto' : ''}`}>
          {formatCredits(balanceUSD)}
        </div>
      </div>
    </div>
  );

  return (
    <Link
      href={usageHref}
      onClick={onNavigate}
      className="block"
      aria-label={`AI credits: ${balanceCredits} remaining, status ${state}`}
    >
      {inner}
    </Link>
  );
}

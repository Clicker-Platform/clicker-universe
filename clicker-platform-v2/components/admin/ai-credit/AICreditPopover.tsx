'use client';

import { useEffect, useRef, type RefObject } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { type CreditState } from '@/lib/hooks/use-ai-credit-status';
import { useAICreditStatusContext } from './AICreditStatusContext';
import { formatCredits } from '@/lib/ai/credits-display';
import { useSite } from '@/lib/site-context';

interface Props {
  open: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
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
    case 'warn':    return 'Running low, top up soon';
    case 'critical':return 'Critical, top up now';
    case 'out':     return 'AI features paused, top up to resume';
  }
}

export function AICreditPopover({ open, onClose, triggerRef }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const status = useAICreditStatusContext();
  const { tenantSlug, isSubdomain } = useSite();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      if (triggerRef?.current && triggerRef.current.contains(target)) return;
      onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;
  if (!status.shouldRender || status.loading) return null;

  const { state, balanceUSD, pct } = status;
  const cls = STATE_CLASSES[state];
  const foot = footerText(state);

  const barPct = pct !== undefined
    ? Math.max(0, Math.min(1, pct)) * 100
    : (state === 'out' ? 0 : state === 'critical' ? 5 : state === 'warn' ? 25 : 100);

  const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';
  const usageHref = `${baseUrl}/admin/ai-usage`;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label="AI credit details"
      className="absolute right-0 top-full mt-1 z-50 w-72 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl p-3 animate-in fade-in duration-150"
    >
      <Link
        href={usageHref}
        onClick={onClose}
        className={`block w-full rounded-lg border px-3 py-2.5 transition-colors hover:brightness-[.98] ${cls.card}`}
      >
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
      </Link>

      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
        Used by AI Sales Agent, Stocklens scanner, and other AI features.
      </p>

      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-neutral-400">Need more?</span>
        <a
          href="mailto:support@clicker.id?subject=AI%20Credit%20Top-up"
          className="font-semibold text-studio-blue hover:underline"
        >
          Contact admin →
        </a>
      </div>
    </div>
  );
}

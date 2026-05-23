'use client';

import { useState, useRef, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useAICreditStatus, type CreditState } from '@/lib/hooks/use-ai-credit-status';
import { formatCreditsShort } from '@/lib/ai/credits-display';
import { AICreditPopover } from './AICreditPopover';

const PILL_CLASSES: Record<CreditState, string> = {
  healthy:  'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700',
  warn:     'border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50',
  critical: 'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50',
  out:      'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50',
};

const RING_CLASSES: Record<CreditState, string> = {
  healthy: 'text-studio-blue',
  warn: 'text-amber-500',
  critical: 'text-red-500',
  out: 'text-red-500',
};

export function AICreditPill() {
  const status = useAICreditStatus();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Defensive: close popover if gating flips to false mid-session
  useEffect(() => { if (!status.shouldRender) setOpen(false); }, [status.shouldRender]);

  if (!status.shouldRender || status.loading) return null;

  const { state, balanceUSD, balanceCredits } = status;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`AI credits: ${balanceCredits} remaining`}
        aria-expanded={open}
        title={`AI credits: ${balanceCredits.toLocaleString('en-US')} remaining`}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-semibold tabular-nums transition-colors ${PILL_CLASSES[state]}`}
      >
        <Zap size={12} className={RING_CLASSES[state]} />
        <span>{formatCreditsShort(balanceUSD)}</span>
        {state === 'out' && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-0.5" aria-hidden="true" />
        )}
      </button>

      <AICreditPopover open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

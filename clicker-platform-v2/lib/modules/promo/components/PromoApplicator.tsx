'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Tag, X } from 'lucide-react';
import { evaluatePromo, findAutoApplicable } from '@/lib/modules/promo/api';
import type { AppliedPromo, PromoSource } from '@/lib/modules/promo/api';
import { logger } from '@/lib/logger-edge';
import { useAnalytics } from '@/lib/analytics/useAnalytics';

export interface PromoApplicatorProps {
  siteId: string;
  subtotal: number;
  source: PromoSource;
  memberId?: string;
  applied: AppliedPromo | null;
  onApply: (result: AppliedPromo) => void;
  onRemove: () => void;
  disabled?: boolean;
  autoCheck?: boolean;
}

function formatDiscount(discount: number): string {
  return `Rp ${discount.toLocaleString('id-ID')}`;
}

export function PromoApplicator({
  siteId,
  subtotal,
  source,
  memberId,
  applied,
  onApply,
  onRemove,
  disabled = false,
  autoCheck = false,
}: PromoApplicatorProps) {
  const { capture } = useAnalytics();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoChecked = useRef(false);

  // Auto-check on mount if enabled and nothing is already applied
  useEffect(() => {
    if (!autoCheck || applied !== null || subtotal <= 0 || autoChecked.current) return;
    autoChecked.current = true;

    async function runAutoCheck() {
      setAutoLoading(true);
      try {
        const result = await findAutoApplicable(siteId, subtotal, source, memberId);
        if (result && result.ok) {
          onApply({
            refId: result.refId,
            kind: result.kind,
            label: result.label,
            discount: result.discount,
          });
        }
      } catch (err) {
        logger.error('promo.applicator.auto-check.failed', { siteId, error: err });
      } finally {
        setAutoLoading(false);
      }
    }

    runAutoCheck();
  }, [autoCheck, applied, subtotal, siteId, source, memberId, onApply]);

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed || disabled) return;

    setLoading(true);
    setError(null);
    try {
      const result = await evaluatePromo({ siteId, code: trimmed, subtotal, source, memberId });
      if (result.ok) {
        onApply({
          refId: result.refId,
          kind: result.kind,
          label: result.label,
          discount: result.discount,
        });
        capture('promo.code_applied', { promoCode: trimmed });
        setCode('');
      } else {
        setError(result.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to apply promo code.';
      setError(msg);
      logger.error('promo.applicator.apply.failed', { siteId, code: trimmed, error: err });
    } finally {
      setLoading(false);
    }
  }

  async function _handleAutoCheck() {
    if (disabled || autoLoading) return;

    setAutoLoading(true);
    setError(null);
    try {
      const result = await findAutoApplicable(siteId, subtotal, source, memberId);
      if (result && result.ok) {
        onApply({
          refId: result.refId,
          kind: result.kind,
          label: result.label,
          discount: result.discount,
        });
      } else {
        setError('No automatic promos available for this order.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto-check failed.';
      setError(msg);
      logger.error('promo.applicator.auto-check-manual.failed', { siteId, error: err });
    } finally {
      setAutoLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  }

  // State B — promo applied
  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300 truncate">
            {applied.label}
          </span>
          <span className="text-sm text-green-600 dark:text-green-400 shrink-0">
            — {formatDiscount(applied.discount)} off
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove promo"
          className="p-1 rounded text-green-500 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // State A — nothing applied
  return (
    <div className="space-y-2">
      {/* Code input row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder="Enter promo or voucher code"
          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-studio-blue/50 placeholder:text-gray-400 dark:placeholder:text-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled || loading || !code.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-studio-blue text-white hover:bg-studio-blue/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : null}
          Apply
        </button>
      </div>


      {/* Inline error */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}

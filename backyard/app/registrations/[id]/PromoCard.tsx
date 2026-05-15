'use client';

import { useEffect, useState } from 'react';

interface Props { code: string | null; platformBaseUrl: string }

interface PromoDetail {
  name?: string;
  kind?: 'percent' | 'fixed';
  value?: number;
  maxDiscount?: number;
}

function formatDiscount(d: PromoDetail): string | null {
  if (!d.kind || d.value == null) return null;
  if (d.kind === 'percent') {
    const max = d.maxDiscount ? ` (maks Rp${d.maxDiscount.toLocaleString('id-ID')})` : '';
    return `Diskon ${d.value}%${max}`;
  }
  return `Diskon Rp${d.value.toLocaleString('id-ID')}`;
}

type PromoStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface PromoResult {
  status: PromoStatus;
  reason: string;
  detail: PromoDetail | null;
}

const IDLE: PromoResult = { status: 'idle', reason: '', detail: null };

export function PromoCard({ code, platformBaseUrl }: Props) {
  const [result, setResult] = useState<PromoResult>(IDLE);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => { if (!cancelled) setResult({ status: 'checking', reason: '', detail: null }); })
      .then(() => fetch(`${platformBaseUrl}/api/public/validate-promo?code=${encodeURIComponent(code)}`))
      .then(r => r.json())
      .then((d: { valid: boolean; name?: string; kind?: string; value?: number; maxDiscount?: number; reason?: string }) => {
        if (cancelled) return;
        if (d.valid) {
          setResult({
            status: 'valid',
            reason: d.name ?? '',
            detail: { name: d.name, kind: d.kind as PromoDetail['kind'], value: d.value, maxDiscount: d.maxDiscount },
          });
        } else {
          setResult({ status: 'invalid', reason: d.reason ?? '', detail: null });
        }
      })
      .catch(() => { if (!cancelled) setResult({ status: 'invalid', reason: 'error', detail: null }); });
    return () => { cancelled = true; };
  }, [code, platformBaseUrl]);

  const { status, reason, detail } = result;

  if (!code) return <p className="text-gray-500">No promo code</p>;
  return (
    <div className="rounded border p-3">
      <div className="font-mono">{code}</div>
      {status === 'checking' && <p className="text-sm text-gray-500">Checking…</p>}
      {status === 'valid' && (
        <>
          <p className="text-sm text-green-600">✓ Valid {reason && `— ${reason}`}</p>
          {detail && formatDiscount(detail) && (
            <p className="text-sm font-medium text-green-700">{formatDiscount(detail)}</p>
          )}
        </>
      )}
      {status === 'invalid' && <p className="text-sm text-red-600">✗ {reason || 'Invalid'} — will not be applied</p>}
    </div>
  );
}

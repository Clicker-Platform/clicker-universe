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

export function PromoCard({ code, platformBaseUrl }: Props) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [reason, setReason] = useState<string>('');
  const [detail, setDetail] = useState<PromoDetail | null>(null);

  useEffect(() => {
    if (!code) { setStatus('idle'); return; }
    setStatus('checking');
    fetch(`${platformBaseUrl}/api/public/validate-promo?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setStatus('valid');
          setReason(d.name ?? '');
          setDetail({ name: d.name, kind: d.kind, value: d.value, maxDiscount: d.maxDiscount });
        } else {
          setStatus('invalid');
          setReason(d.reason ?? '');
          setDetail(null);
        }
      })
      .catch(() => { setStatus('invalid'); setReason('error'); setDetail(null); });
  }, [code, platformBaseUrl]);

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

'use client';

import { useState } from 'react';

interface Props {
  promoCode: string;
  promoValid: boolean | null;
  promoName: string | null;
  onChange: (value: string) => void;
  onValidated: (valid: boolean, name: string | null) => void;
}

interface DiscountInfo {
  kind?: 'percent' | 'fixed';
  value?: number;
  maxDiscount?: number;
}

function formatDiscount(info: DiscountInfo): string | null {
  if (!info.kind || info.value == null) return null;
  if (info.kind === 'percent') {
    const max = info.maxDiscount
      ? ` (maks Rp${info.maxDiscount.toLocaleString('id-ID')})`
      : '';
    return `Diskon ${info.value}%${max}`;
  }
  return `Diskon Rp${info.value.toLocaleString('id-ID')}`;
}

export function PromoCodeSection({
  promoCode,
  promoValid,
  promoName,
  onChange,
  onValidated,
}: Props) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discount, setDiscount] = useState<DiscountInfo | null>(null);

  async function check() {
    if (!promoCode.trim()) return;
    setChecking(true);
    setError(null);
    setDiscount(null);
    try {
      const res = await fetch(
        `/api/public/validate-promo?code=${encodeURIComponent(promoCode.trim())}`,
      );
      const data = await res.json();
      if (res.ok && data.valid) {
        onValidated(true, data.name ?? null);
        setDiscount({ kind: data.kind, value: data.value, maxDiscount: data.maxDiscount });
      } else {
        onValidated(false, null);
        setError(data.reason ?? 'Kode promo tidak valid');
      }
    } catch {
      onValidated(false, null);
      setError('Gagal cek kode promo. Coba lagi.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <fieldset>
      <legend className="text-lg font-semibold text-neutral-900 mb-2">
        Kode promo (opsional)
      </legend>
      <div className="flex gap-2">
        <input
          type="text"
          value={promoCode}
          onChange={(e) => {
            onChange(e.target.value);
            onValidated(false, null);
            setError(null);
            setDiscount(null);
          }}
          maxLength={80}
          placeholder="Misal: WELCOME"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={check}
          disabled={checking || !promoCode.trim()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {checking ? 'Cek...' : 'Cek kode'}
        </button>
      </div>
      {promoValid && promoName && (
        <div className="mt-1 text-sm text-green-700">
          <p>✓ Kode valid: {promoName}</p>
          {discount && formatDiscount(discount) && (
            <p className="font-medium">{formatDiscount(discount)}</p>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </fieldset>
  );
}

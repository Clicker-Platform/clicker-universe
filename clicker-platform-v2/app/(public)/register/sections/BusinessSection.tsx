'use client';

import type { BusinessType } from '@/lib/registration/types';

interface Props {
  businessName: string;
  businessType: BusinessType;
  city: string;
  expectedOutlets: number;
  errors: Record<string, string[] | undefined>;
  onChange: (
    field: 'businessName' | 'businessType' | 'city' | 'expectedOutlets',
    value: string | number,
  ) => void;
}

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'fnb', label: 'F&B / Restoran / Café' },
  { value: 'auto-detailing', label: 'Auto Detailing / Bengkel' },
  { value: 'beauty-spa', label: 'Beauty / Spa / Salon' },
  { value: 'retail', label: 'Retail' },
  { value: 'service', label: 'Jasa lainnya' },
  { value: 'other', label: 'Lain-lain' },
];

export function BusinessSection({
  businessName,
  businessType,
  city,
  expectedOutlets,
  errors,
  onChange,
}: Props) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-neutral-900 mb-2">Bisnis</legend>

      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-neutral-700">
          Nama bisnis
        </label>
        <input
          id="businessName"
          type="text"
          value={businessName}
          onChange={(e) => onChange('businessName', e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          required
          maxLength={120}
        />
        {errors.businessName && (
          <p className="mt-1 text-sm text-red-600">{errors.businessName[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="businessType" className="block text-sm font-medium text-neutral-700">
          Jenis bisnis
        </label>
        <select
          id="businessType"
          value={businessType}
          onChange={(e) => onChange('businessType', e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        >
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {errors.businessType && (
          <p className="mt-1 text-sm text-red-600">{errors.businessType[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="city" className="block text-sm font-medium text-neutral-700">
          Kota
        </label>
        <input
          id="city"
          type="text"
          value={city}
          onChange={(e) => onChange('city', e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          required
          maxLength={80}
        />
        {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city[0]}</p>}
      </div>

      <div>
        <label htmlFor="expectedOutlets" className="block text-sm font-medium text-neutral-700">
          Perkiraan jumlah outlet
        </label>
        <input
          id="expectedOutlets"
          type="number"
          min={1}
          max={10000}
          value={expectedOutlets}
          onChange={(e) => onChange('expectedOutlets', Number(e.target.value) || 1)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          required
        />
        {errors.expectedOutlets && (
          <p className="mt-1 text-sm text-red-600">{errors.expectedOutlets[0]}</p>
        )}
      </div>
    </fieldset>
  );
}

'use client';

import type { ButtonColors } from '@/lib/buttonPacks/types';
import { pickContrastText } from '@/lib/buttonPacks/contrast';

type Props = {
  colors: ButtonColors;
  onChange: (patch: Partial<ButtonColors>) => void;
};

type Row = {
  key: keyof ButtonColors;
  label: string;
  hint: string;
  optional?: boolean;
};

const ROWS: Row[] = [
  { key: 'primaryFill',     label: 'Primary fill',     hint: 'Background of primary buttons' },
  { key: 'primaryText',     label: 'Primary text',     hint: 'Auto-contrast with fill',          optional: true },
  { key: 'secondaryBorder', label: 'Secondary border', hint: 'Border + default text on secondary' },
  { key: 'secondaryText',   label: 'Secondary text',   hint: 'Defaults to border color' },
  { key: 'tertiaryText',    label: 'Tertiary text',    hint: 'Color of text-link tier' },
];

export function ButtonColorsEditor({ colors, onChange }: Props) {
  const autoPrimaryText = pickContrastText(colors.primaryFill);

  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Colors</div>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800">
        {ROWS.map(row => {
          const value = colors[row.key];
          const isAuto = row.optional && (value === undefined || value === null || value === '');
          const displayHex = isAuto ? autoPrimaryText : (value ?? '#000000');
          return (
            <div key={row.key} className="flex items-center justify-between px-3 py-2">
              <div className="flex flex-col">
                <span className="text-sm">{row.label}</span>
                <span className="text-[11px] text-neutral-500">{row.hint}</span>
              </div>
              <div className="flex items-center gap-2">
                {isAuto && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    AUTO · {autoPrimaryText.toUpperCase()}
                  </span>
                )}
                <code className="text-xs text-neutral-500">{displayHex.toUpperCase()}</code>
                <input
                  type="color"
                  value={displayHex}
                  onChange={(e) => onChange({ [row.key]: e.target.value } as Partial<ButtonColors>)}
                  className="w-7 h-7 rounded border border-neutral-300 cursor-pointer"
                  aria-label={row.label}
                />
                {row.optional && !isAuto && (
                  <button
                    type="button"
                    onClick={() => onChange({ [row.key]: undefined } as Partial<ButtonColors>)}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    auto
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

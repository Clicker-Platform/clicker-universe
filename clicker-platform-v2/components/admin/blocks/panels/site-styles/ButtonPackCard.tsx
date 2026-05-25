'use client';

import { Check } from 'lucide-react';
import type { ButtonPack } from '@/lib/buttonPacks/types';

type Props = {
  pack: ButtonPack;
  active: boolean;
  onClick: () => void;
};

export function ButtonPackCard({ pack, active, onClick }: Props) {
  const baseBtn = {
    fontWeight: pack.fontWeight,
    letterSpacing: pack.letterSpacing,
    textTransform: pack.textTransform,
    borderRadius: pack.radius,
    padding: '6px 14px',
    fontSize: 10,
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group relative w-full rounded-lg border bg-white dark:bg-neutral-900 text-left',
        'px-4 py-4 transition-all flex flex-col gap-2 items-center',
        active
          ? 'border-transparent ring-2 ring-blue-600 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      {active && (
        <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      <div style={{ ...baseBtn, background: '#111', color: '#fff', border: 0 }}>Primary</div>
      <div style={{
        ...baseBtn,
        background: 'transparent',
        color: '#111',
        border: `${pack.borderWidth}px solid #111`,
        padding: `${6 - pack.borderWidth}px ${14 - pack.borderWidth}px`,
      }}>Secondary</div>
      <div style={{
        fontWeight: pack.fontWeight,
        letterSpacing: pack.letterSpacing,
        textTransform: pack.textTransform,
        fontSize: 10,
        textDecoration: pack.tertiaryStyle === 'underline' ? 'underline' : 'none',
        textUnderlineOffset: 4,
      }}>
        Tertiary{pack.tertiaryStyle === 'arrow' ? ' →' : ''}
      </div>

      <div className="mt-2 text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {pack.displayName}
      </div>
    </button>
  );
}

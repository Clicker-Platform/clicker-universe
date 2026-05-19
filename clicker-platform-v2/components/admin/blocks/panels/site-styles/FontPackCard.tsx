'use client';

import { Check } from 'lucide-react';
import type { FontPack } from '@/lib/fonts/types';

type Props = {
  pack: FontPack;
  active: boolean;
  onClick: () => void;
};

export function FontPackCard({ pack, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group relative w-full rounded-lg border bg-white dark:bg-neutral-900 text-left',
        'px-4 py-4 transition-all',
        active
          ? 'border-blue-600 ring-2 ring-blue-600 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      <div
        className="text-neutral-900 dark:text-neutral-100 leading-tight"
        style={{ fontFamily: 'var(' + pack.heading.cssVar + ')', fontWeight: 700, fontSize: 32 }}
      >
        Heading
      </div>
      <div
        className="text-neutral-700 dark:text-neutral-300 mt-1"
        style={{ fontFamily: 'var(' + pack.body.cssVar + ')', fontWeight: 400, fontSize: 14 }}
      >
        This is your paragraph.
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {pack.heading.family} / {pack.body.family}
      </div>
    </button>
  );
}

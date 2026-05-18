'use client';

import type { LucideIcon } from 'lucide-react';

type Props = { icon: LucideIcon; label: string };

export function ComingSoonTile({ icon: Icon, label }: Props) {
  return (
    <div
      aria-disabled
      className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 px-3 py-3 opacity-60"
    >
      <Icon className="h-4 w-4 text-neutral-400" />
      <div className="flex-1">
        <div className="text-sm text-neutral-700 dark:text-neutral-300">{label}</div>
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Coming soon</div>
      </div>
    </div>
  );
}

'use client';

import { AlertCircle, Loader } from 'lucide-react';

/**
 * Editor-only diagnostic placeholder for data-dependent blocks.
 * Renders nothing on the public site so empty blocks stay invisible there.
 *
 * - During hydration (`isHydrating`), shows a neutral loading row instead of
 *   the warning, so users don't see a misleading "no data" message while the
 *   fetch is still in flight after dropping a new data-dependent block in.
 * - When hydration is done, shows the actual reason in amber.
 */
export function EmptyBlockHint({
  previewMode,
  blockLabel,
  reason,
  isHydrating,
}: {
  previewMode?: boolean;
  blockLabel: string;
  reason: string;
  isHydrating?: boolean;
}) {
  if (!previewMode) return null;

  if (isHydrating) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded text-neutral-500 dark:text-neutral-400">
        <Loader size={14} className="flex-shrink-0 animate-spin" />
        <span className="flex-1">
          <strong>{blockLabel}:</strong> Loading…
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded text-amber-800 dark:text-amber-200">
      <AlertCircle size={14} className="flex-shrink-0" />
      <span className="flex-1">
        <strong>{blockLabel}:</strong> {reason}
      </span>
    </div>
  );
}

'use client';

import { AlertCircle } from 'lucide-react';

/**
 * Editor-only diagnostic placeholder for data-dependent blocks.
 * Renders nothing on the public site so empty blocks stay invisible there.
 * Use to explain WHY a block is empty so the editor user can fix the data.
 */
export function EmptyBlockHint({
  previewMode,
  blockLabel,
  reason,
}: {
  previewMode?: boolean;
  blockLabel: string;
  reason: string;
}) {
  if (!previewMode) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded text-amber-800 dark:text-amber-200">
      <AlertCircle size={14} className="flex-shrink-0" />
      <span className="flex-1">
        <strong>{blockLabel}:</strong> {reason}
      </span>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { ModuleDefinition } from '@/lib/modules/types';

interface Props {
  open: boolean;
  candidates: ModuleDefinition[];
  currentVisible: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

export function AddModuleWidgetPicker({ open, candidates, currentVisible, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentVisible));

  useEffect(() => {
    if (open) Promise.resolve().then(() => setSelected(new Set(currentVisible)));
  }, [open, currentVisible]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    const kept = currentVisible.filter(id => selected.has(id));
    const added = candidates
      .map(c => c.id)
      .filter(id => selected.has(id) && !currentVisible.includes(id));
    onSave([...kept, ...added]);
    onClose();
  };

  return (
    <div className="absolute z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
      <div className="p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Add to overview
        </p>
        {candidates.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No modules with overview widgets yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {candidates.map(c => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    aria-label={c.displayName}
                  />
                  <span>{c.displayName}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-neutral-800 p-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-3 py-1 rounded text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="text-xs px-3 py-1 rounded bg-gray-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90"
        >
          Save
        </button>
      </div>
    </div>
  );
}

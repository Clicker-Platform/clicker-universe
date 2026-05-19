'use client';

import { useEffect, useRef, useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { X } from 'lucide-react';

interface CellColorFieldProps {
  value?: string;
  onChange: (color: string | undefined) => void;
}

export function CellColorField({ value, onChange }: CellColorFieldProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const display = value ?? '#ffffff';

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="h-7 w-7 rounded border border-gray-300 dark:border-neutral-700 shadow-sm"
          style={{ backgroundColor: display }}
          aria-label="Pick background color"
        />
        <HexColorInput
          color={display}
          onChange={(c) => onChange(c)}
          prefixed
          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 font-mono uppercase"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="Clear color"
            className="text-neutral-400 hover:text-red-500"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-2 p-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-md shadow-lg">
          <HexColorPicker color={display} onChange={(c) => onChange(c)} />
        </div>
      )}
    </div>
  );
}

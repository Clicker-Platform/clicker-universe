'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onTick: () => void;
  intervalMs: number;
  paused: boolean;
}

export function LiveModeToggle({ onTick, intervalMs, paused }: Props) {
  const [enabled, setEnabled] = useState(false);
  const tickRef = useRef(onTick);

  useEffect(() => {
    tickRef.current = onTick;
  });

  useEffect(() => {
    if (!enabled || paused) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const id = setInterval(() => tickRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, paused, intervalMs]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      setEnabled((v) => v);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span>Live mode</span>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label="Live mode"
        onClick={() => setEnabled((v) => !v)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          enabled ? 'bg-brand-dark' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

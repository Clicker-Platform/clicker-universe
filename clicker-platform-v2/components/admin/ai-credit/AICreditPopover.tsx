'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { AICreditCard } from './AICreditCard';

interface Props {
  open: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}

export function AICreditPopover({ open, onClose, triggerRef }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      if (triggerRef?.current && triggerRef.current.contains(target)) return;
      onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label="AI credit details"
      className="absolute right-0 top-full mt-1 z-50 w-72 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl p-3 animate-in fade-in duration-150"
    >
      <AICreditCard variant="popover" onNavigate={onClose} />

      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
        Used by AI Sales Agent, Stocklens scanner, and other AI features.
      </p>

      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-neutral-400">Need more?</span>
        <a
          href="mailto:support@clicker.id?subject=AI%20Credit%20Top-up"
          className="font-semibold text-studio-blue hover:underline"
        >
          Contact admin →
        </a>
      </div>
    </div>
  );
}

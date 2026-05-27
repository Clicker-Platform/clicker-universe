// clicker-platform-v2/components/admin/blocks/rich-text/popovers/Popover.tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
    open: boolean;
    onClose: () => void;
    anchor: HTMLElement | null;
    children: ReactNode;
    placement?: 'bottom-start' | 'bottom' | 'bottom-end';
}

/**
 * Anchored, portaled, click-outside-to-close popover. Lives at document.body
 * to escape any transformed ancestor (same lesson as the MediaPicker portal).
 *
 * On mobile (< 768px viewport), the popover ignores `anchor` and centers
 * on the screen, because anchoring to a small target inside a bottom-sheet
 * produces clipped results.
 */
export function Popover({ open, onClose, anchor, children, placement = 'bottom-start' }: PopoverProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number; centered: boolean }>({ top: 0, left: 0, centered: false });

    useLayoutEffect(() => {
        if (!open || !anchor) return;
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        if (isMobile) {
            setPosition({ top: 0, left: 0, centered: true });
            return;
        }
        const r = anchor.getBoundingClientRect();
        const offset = 4;
        let left: number;
        switch (placement) {
            case 'bottom':       left = r.left + r.width / 2; break;
            case 'bottom-end':   left = r.right; break;
            case 'bottom-start':
            default:             left = r.left;
        }
        setPosition({ top: r.bottom + offset, left, centered: false });
    }, [open, anchor, placement]);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            if (!ref.current) return;
            if (ref.current.contains(e.target as Node)) return;
            if (anchor && anchor.contains(e.target as Node)) return;
            onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, anchor, onClose]);

    if (!open || typeof document === 'undefined') return null;

    const style: React.CSSProperties = position.centered
        ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 60 }
        : { position: 'fixed', top: position.top, left: position.left, zIndex: 60,
            transform: placement === 'bottom' ? 'translateX(-50%)' : placement === 'bottom-end' ? 'translateX(-100%)' : 'none' };

    return createPortal(
        <div ref={ref} style={style} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-xl">
            {children}
        </div>,
        document.body,
    );
}

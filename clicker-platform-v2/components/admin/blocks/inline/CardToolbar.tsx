'use client';

import React from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

interface CardToolbarProps {
    /** Display label like "Card #1". */
    label: string;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDelete: () => void;
}

/**
 * Floating mini-toolbar shown above the currently selected child card on the
 * canvas. Visual parity with the Hero block's inline button toolbar.
 *
 * Positioning is the caller's responsibility — render this absolutely
 * positioned relative to the card wrapper (top-aligned, slightly above).
 */
export function CardToolbar({
    label,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onDelete,
}: CardToolbarProps) {
    const stop = (fn: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        fn();
    };

    const btn =
        'p-1.5 rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 ' +
        'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-600 ' +
        'transition-colors';

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            className="
                absolute -top-9 left-0 z-30
                flex items-center gap-0.5
                px-1.5 py-1
                bg-white rounded-lg shadow-md border border-neutral-200
                text-xs font-medium
            "
        >
            <span className="px-2 py-0.5 text-neutral-700 select-none">{label}</span>
            <span className="w-px h-4 bg-neutral-200 mx-0.5" />
            <button
                type="button"
                aria-label="Move up"
                disabled={!canMoveUp}
                onClick={stop(onMoveUp)}
                className={btn}
            >
                <ChevronUp size={14} />
            </button>
            <button
                type="button"
                aria-label="Move down"
                disabled={!canMoveDown}
                onClick={stop(onMoveDown)}
                className={btn}
            >
                <ChevronDown size={14} />
            </button>
            <span className="w-px h-4 bg-neutral-200 mx-0.5" />
            <button
                type="button"
                aria-label="Delete card"
                onClick={stop(onDelete)}
                className={`${btn} hover:text-red-600`}
            >
                <Trash2 size={13} />
            </button>
        </div>
    );
}

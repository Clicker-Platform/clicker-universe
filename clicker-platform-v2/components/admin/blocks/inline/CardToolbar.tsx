'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';

export type AddableField = 'label' | 'body';
export type ToolbarPlacement = 'above' | 'overlay';

interface CardToolbarProps {
    /** Display label like "Card #1". */
    label: string;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDelete: () => void;
    /** Optional fields currently empty on the card. Renders a "+ Field" button per entry. */
    missingFields?: AddableField[];
    onAddField?: (field: AddableField) => void;
    /**
     * - 'above'   → toolbar floats above the card (desktop default).
     * - 'overlay' → toolbar sits inside the card at top-left with a translucent
     *               background. Used in mobile preview where the carousel's
     *               overflow-x-auto would clip an above-card toolbar.
     */
    placement?: ToolbarPlacement;
}

const FIELD_LABEL: Record<AddableField, string> = {
    label: 'Label',
    body: 'Body',
};

/**
 * Floating mini-toolbar shown above (or overlaid on) the currently selected
 * card. Caller renders this inside a `relative` card wrapper.
 *
 * Delete: clicking trash overlays Confirm/Cancel at the right edge of the
 * toolbar — toolbar width doesn't grow. Dismisses on outside click or Escape.
 */
export function CardToolbar({
    label,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onDelete,
    missingFields,
    onAddField,
    placement = 'above',
}: CardToolbarProps) {
    const [confirming, setConfirming] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!confirming) return;
        const onDown = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setConfirming(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirming(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [confirming]);

    const stop = (fn: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        fn();
    };

    const btn =
        'p-1.5 rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 ' +
        'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-600 ' +
        'transition-colors';

    const positionClass = placement === 'above'
        ? '-top-9 left-0 bg-white'
        : 'top-2 left-2 bg-white/90 backdrop-blur-sm';

    return (
        <div
            ref={wrapRef}
            onClick={(e) => e.stopPropagation()}
            className={`
                absolute ${positionClass} z-30
                flex items-center gap-0.5 flex-nowrap whitespace-nowrap
                px-1.5 py-1
                rounded-lg shadow-md border border-neutral-200
                text-xs font-medium
            `}
        >
            <span className="px-2 py-0.5 text-neutral-700 select-none truncate max-w-[8rem]" title={label}>{label}</span>
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
            {missingFields && missingFields.length > 0 && onAddField && (
                <>
                    <span className="w-px h-4 bg-neutral-200 mx-0.5" />
                    {missingFields.map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={stop(() => onAddField(f))}
                            className={`${btn} inline-flex items-center gap-1 px-2`}
                            title={`Add ${FIELD_LABEL[f].toLowerCase()}`}
                        >
                            <Plus size={12} />
                            <span>{FIELD_LABEL[f]}</span>
                        </button>
                    ))}
                </>
            )}
            <span className="w-px h-4 bg-neutral-200 mx-0.5" />
            <button
                type="button"
                aria-label="Delete card"
                onClick={stop(() => setConfirming(true))}
                className={`${btn} hover:text-red-600`}
            >
                <Trash2 size={13} />
            </button>

            {confirming && (
                <div className={`absolute inset-y-0 right-0 flex items-center gap-0.5 pl-2 pr-1.5 rounded-r-lg ${placement === 'above' ? 'bg-white' : 'bg-white/90 backdrop-blur-sm'}`}>
                    <button
                        type="button"
                        onClick={stop(onDelete)}
                        className="px-2 py-0.5 text-xs font-semibold rounded-md bg-red-100 text-red-600 ring-1 ring-red-200 hover:bg-red-200 transition-colors"
                    >
                        Confirm
                    </button>
                    <button
                        type="button"
                        onClick={stop(() => setConfirming(false))}
                        className="px-2 py-0.5 text-xs rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

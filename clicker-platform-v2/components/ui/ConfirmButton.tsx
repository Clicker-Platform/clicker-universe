'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
    onConfirm: () => void | Promise<void>;
    /** Trigger label (e.g. "Delete"). Ignored when `triggerIcon` is used alone. */
    label?: string;
    /** Optional leading icon for the trigger. */
    triggerIcon?: ReactNode;
    /** When true, render trigger as icon-only (uses `triggerIcon`, requires `triggerTitle`). */
    iconOnly?: boolean;
    /** Tooltip for icon-only trigger; also used as aria-label. */
    triggerTitle?: string;
    /** Label shown on the confirm button. Default: "Confirm". */
    confirmLabel?: string;
    /** Cancel button label. Default: "Cancel". */
    cancelLabel?: string;
    /** Spinner on the confirm button while the action runs. */
    loading?: boolean;
    /** Disable the whole control. */
    disabled?: boolean;
    /** Tailwind classes for the trigger button (override or extend default red treatment). */
    triggerClassName?: string;
    /** className for the outer wrapper. */
    className?: string;
}

const DEFAULT_LABELED_TRIGGER =
    'px-3 py-1.5 text-sm rounded-md bg-red-600 text-white inline-flex items-center gap-1 hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const DEFAULT_ICON_TRIGGER =
    'p-2 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * Two-step confirmation for destructive actions. First click swaps the trigger
 * with an inline "Confirm" / "Cancel" pair (soft red treatment on Confirm so a
 * slip doesn't fire the action). Replaces window.confirm() for destructive UI.
 *
 * Dismisses on Escape or outside click.
 */
export function ConfirmButton({
    onConfirm,
    label,
    triggerIcon,
    iconOnly,
    triggerTitle,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    loading,
    disabled,
    triggerClassName,
    className,
}: Props) {
    const [confirming, setConfirming] = useState(false);
    const wrapRef = useRef<HTMLSpanElement>(null);

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

    const wrapperCls = className
        ? `inline-flex items-center gap-2 ${className}`
        : 'inline-flex items-center gap-2';

    if (confirming) {
        return (
            <span ref={wrapRef} className={wrapperCls}>
                <button
                    type="button"
                    onClick={() => { if (!disabled && !loading) onConfirm(); }}
                    disabled={disabled || loading}
                    className="px-3 py-1.5 text-sm font-semibold rounded-md bg-red-100 text-red-600 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30 inline-flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-500/25 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading && <Loader2 size={12} className="animate-spin" />}
                    {confirmLabel}
                </button>
                <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                    {cancelLabel}
                </button>
            </span>
        );
    }

    const triggerCls = triggerClassName ?? (iconOnly ? DEFAULT_ICON_TRIGGER : DEFAULT_LABELED_TRIGGER);

    return (
        <span ref={wrapRef} className={wrapperCls}>
            <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={disabled}
                title={triggerTitle}
                aria-label={iconOnly ? triggerTitle : undefined}
                className={triggerCls}
            >
                {triggerIcon}
                {!iconOnly && label}
            </button>
        </span>
    );
}

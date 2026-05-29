'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface SelectOption {
    /** Stable value persisted on selection. */
    value: string;
    /** Primary label shown in the trigger and as the main row text. */
    label: string;
    /** Optional muted hint, right-aligned in the row (e.g. a page slug). */
    hint?: string;
}

interface SelectMenuProps {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    /** Trigger text shown when no option is selected. Also the "clear" row label. */
    placeholder?: string;
    /** Show a filter box above the list. Auto-enabled at 8+ options when undefined. */
    searchable?: boolean;
    /** Allow returning to the empty/placeholder state via a top row. */
    allowClear?: boolean;
    className?: string;
}

const triggerClass =
    'w-full flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 hover:border-gray-400 dark:hover:border-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer';

/**
 * Themed, optionally-searchable dropdown — a drop-in replacement for native
 * <select> in block forms so menus match the admin theme (the native control
 * renders an OS popup that ignores dark mode). Mirrors the trigger + absolute
 * panel + outside-click pattern of PageSwitcherDropdown.
 */
export function SelectMenu({
    value,
    options,
    onChange,
    placeholder = 'Select…',
    searchable,
    allowClear = true,
    className = '',
}: SelectMenuProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [dropUp, setDropUp] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const showSearch = searchable ?? options.length >= 8;
    const selected = options.find(o => o.value === value) || null;

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus the filter box and reset the query each time the menu opens.
    useEffect(() => {
        if (open) {
            setQuery('');
            if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
        }
    }, [open, showSearch]);

    // The form sidebar is overflow-y-auto, so a downward menu can be clipped near
    // the bottom. Flip upward when there's more room above than below the trigger.
    useEffect(() => {
        if (!open || !rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        const below = window.innerHeight - rect.bottom;
        const above = rect.top;
        setDropUp(below < 280 && above > below);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o =>
            o.label.toLowerCase().includes(q) || (o.hint?.toLowerCase().includes(q) ?? false)
        );
    }, [options, query]);

    const select = (v: string) => {
        onChange(v);
        setOpen(false);
    };

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button type="button" onClick={() => setOpen(o => !o)} className={triggerClass}>
                <span className={`truncate flex-1 text-left ${selected ? 'font-medium' : 'text-neutral-400 dark:text-neutral-500'}`}>
                    {selected ? selected.label : placeholder}
                </span>
                {selected?.hint && (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 flex-shrink-0">{selected.hint}</span>
                )}
                <ChevronDown size={14} className="text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
            </button>

            {open && (
                <div className={`absolute left-0 right-0 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg shadow-2xl z-30 overflow-hidden`}>
                    {showSearch && (
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-neutral-700">
                            <Search size={14} className="text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                            <input
                                ref={searchRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Filter…"
                                className="w-full bg-transparent text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none"
                            />
                        </div>
                    )}
                    <div className="max-h-64 overflow-y-auto p-1">
                        {allowClear && (
                            <button
                                type="button"
                                onClick={() => select('')}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-sm ${
                                    !value
                                        ? 'bg-blue-500/15 text-blue-500'
                                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
                                }`}
                            >
                                <span className="truncate flex-1">{placeholder}</span>
                                {!value && <Check size={14} className="flex-shrink-0" />}
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-neutral-400 dark:text-neutral-500 text-xs">
                                No matches
                            </div>
                        ) : (
                            filtered.map(opt => {
                                const isSelected = opt.value === value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => select(opt.value)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-sm ${
                                            isSelected
                                                ? 'bg-blue-500/15 text-blue-500'
                                                : 'text-neutral-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700'
                                        }`}
                                    >
                                        <span className="truncate flex-1 font-medium">{opt.label}</span>
                                        {opt.hint && (
                                            <span className={`text-xs flex-shrink-0 ${isSelected ? 'text-blue-500/70' : 'text-neutral-400 dark:text-neutral-500'}`}>
                                                {opt.hint}
                                            </span>
                                        )}
                                        {isSelected && <Check size={14} className="flex-shrink-0" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

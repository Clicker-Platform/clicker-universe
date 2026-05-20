'use client';

import { X } from 'lucide-react';
import type { MediaUsage } from '@/lib/media/types';

interface Props {
    open: boolean;
    usages: MediaUsage[];
    onCancel: () => void;
    onForceDelete: () => void;
}

export function MediaUsageModal({ open, usages, onCancel, onForceDelete }: Props) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onCancel}
        >
            <div
                className="w-[480px] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-neutral-800">
                    <span className="font-semibold text-sm">This file is in use</span>
                    <button
                        onClick={onCancel}
                        aria-label="Close"
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                    >
                        <X size={14} />
                    </button>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Deleting will break the following references:
                    </p>
                    <ul className="text-sm space-y-1">
                        {usages.map((u, i) => (
                            <li
                                key={i}
                                className="flex justify-between border-b border-gray-100 dark:border-neutral-800 py-1.5"
                            >
                                <span>{u.label}</span>
                                <span className="text-neutral-400">{u.location}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onForceDelete}
                        className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                        Force delete
                    </button>
                </div>
            </div>
        </div>
    );
}

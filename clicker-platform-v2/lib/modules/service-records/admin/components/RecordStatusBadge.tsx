'use client';

import type { RecordStatus } from '../../types';

const STATUS_CONFIG: Record<RecordStatus, { label: string; className: string }> = {
    ACTIVE:    { label: 'Active',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
    COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
    CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' },
};

interface Props {
    status: RecordStatus;
    size?: 'sm' | 'md';
}

export function RecordStatusBadge({ status, size = 'md' }: Props) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400' };
    const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';
    return (
        <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${cfg.className}`}>
            {cfg.label}
        </span>
    );
}

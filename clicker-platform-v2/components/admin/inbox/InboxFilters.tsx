import { memo } from 'react';

type FilterStatus = 'all' | 'new' | 'read' | 'archived';

interface InboxFiltersProps {
    currentFilter: FilterStatus;
    onFilterChange: (status: FilterStatus) => void;
    counts: Record<FilterStatus, number>;
    compact?: boolean;
}

export const InboxFilters = memo(function InboxFilters({
    currentFilter,
    onFilterChange,
    counts,
    compact = false
}: InboxFiltersProps) {

    const filters: FilterStatus[] = ['all', 'new', 'read', 'archived'];

    return (
        <div className={`flex items-center gap-1.5 overflow-x-auto ${compact ? 'mb-2 pb-1' : 'gap-2 mb-6 pb-2'}`}>
            {filters.map((status) => (
                <button
                    key={status}
                    onClick={() => onFilterChange(status)}
                    className={`
                        ${compact ? 'px-2.5 py-1 rounded-lg text-xs' : 'px-4 py-2 rounded-full text-sm'} font-bold transition-colors whitespace-nowrap
                        ${currentFilter === status
                            ? 'bg-brand-dark text-white dark:bg-neutral-100 dark:text-neutral-900'
                            : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:border-neutral-800'}
                    `}
                >
                    <span className="capitalize">{status === 'all' ? 'Inbox' : status}</span>
                    <span className={`${compact ? 'ml-1 px-1 py-0.5 text-[9px]' : 'ml-2 px-1.5 py-0.5 text-[10px]'} rounded-full ${currentFilter === status ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900' : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                        {counts[status]}
                    </span>
                </button>
            ))}
        </div>
    );
});

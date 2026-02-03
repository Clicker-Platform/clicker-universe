import { memo } from 'react';

type FilterStatus = 'all' | 'new' | 'read' | 'archived';

interface InboxFiltersProps {
    currentFilter: FilterStatus;
    onFilterChange: (status: FilterStatus) => void;
    counts: Record<FilterStatus, number>;
}

export const InboxFilters = memo(function InboxFilters({
    currentFilter,
    onFilterChange,
    counts
}: InboxFiltersProps) {

    const filters: FilterStatus[] = ['all', 'new', 'read', 'archived'];

    return (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {filters.map((status) => (
                <button
                    key={status}
                    onClick={() => onFilterChange(status)}
                    className={`
                        px-4 py-2 rounded-full text-sm font-bold transition-colors whitespace-nowrap
                        ${currentFilter === status
                            ? 'bg-brand-dark text-white'
                            : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}
                    `}
                >
                    <span className="capitalize">{status === 'all' ? 'Inbox' : status}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${currentFilter === status ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {counts[status]}
                    </span>
                </button>
            ))}
        </div>
    );
});

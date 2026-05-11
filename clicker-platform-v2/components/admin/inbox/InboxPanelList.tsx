'use client';

import { memo } from 'react';
import { Inbox, Mail, MailOpen, Loader2 } from 'lucide-react';
import { Submission } from '@/data/mockData';
import { InboxFilters } from './InboxFilters';

type FilterStatus = 'all' | 'new' | 'read' | 'archived';

interface InboxPanelListProps {
    submissions: Submission[];
    statusCounts: Record<'new' | 'read' | 'archived', number>;
    filterStatus: FilterStatus;
    onFilterChange: (status: FilterStatus) => void;
    onSelect: (id: string) => void;
    onMarkRead: (id: string) => void;
    loadingId: string | null;
    itemLimit: number;
    onLoadMore: () => void;
    hasMore: boolean;
}

function formatDate(ts: any): string {
    if (!ts) return '';
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const InboxPanelList = memo(function InboxPanelList({
    submissions,
    statusCounts,
    filterStatus,
    onFilterChange,
    onSelect,
    onMarkRead,
    loadingId,
    itemLimit,
    onLoadMore,
    hasMore,
}: InboxPanelListProps) {
    const filtered = submissions.filter(sub => {
        if (filterStatus === 'all') return sub.status !== 'archived';
        return sub.status === filterStatus;
    });

    const counts = {
        all: statusCounts.new + statusCounts.read,
        new: statusCounts.new,
        read: statusCounts.read,
        archived: statusCounts.archived,
    };

    return (
        <div className="flex flex-col h-full">
            {/* Compact filters */}
            <div className="px-4 pt-3 pb-1 shrink-0">
                <InboxFilters
                    currentFilter={filterStatus}
                    onFilterChange={onFilterChange}
                    counts={counts}
                    compact
                />
            </div>

            {/* Submission rows */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-neutral-600 py-16">
                        <Inbox size={32} className="opacity-40" />
                        <p className="text-sm font-bold">
                            {filterStatus === 'archived' ? 'No archived items' : 'No submissions yet'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {filtered.map((sub) => {
                            const isNew = sub.status === 'new';
                            const isLoading = loadingId === sub.id;
                            const fields = sub.fieldLabels
                                ? Object.entries(sub.fieldLabels).slice(0, 3)
                                : Object.entries(sub.data || {}).slice(0, 3);

                            return (
                                <div
                                    key={sub.id}
                                    onClick={() => onSelect(sub.id)}
                                    className={`w-full text-left px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer ${isNew ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <div className="mt-0.5 shrink-0">
                                                {isNew
                                                    ? <Mail size={14} className="text-blue-500" />
                                                    : <MailOpen size={14} className="text-gray-400 dark:text-neutral-600" />
                                                }
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm truncate ${isNew ? 'font-bold text-brand-dark dark:text-neutral-100' : 'font-medium text-gray-600 dark:text-neutral-400'}`}>
                                                    {sub.formTitle || 'Submission'}
                                                </p>
                                                {fields.length > 0 && (
                                                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">
                                                        {fields.map(([k]) => {
                                                            const val = sub.data?.[k];
                                                            return val ? String(val) : null;
                                                        }).filter(Boolean).join(' \u00b7 ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[11px] text-gray-400 dark:text-neutral-600 whitespace-nowrap">
                                                {formatDate(sub.submittedAt)}
                                            </span>
                                            {isNew && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onMarkRead(sub.id);
                                                    }}
                                                    title="Mark as read"
                                                    disabled={isLoading}
                                                    className={`p-1 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors ${isLoading ? 'opacity-40' : ''}`}
                                                >
                                                    <MailOpen size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Load more */}
                        {hasMore && (
                            <div className="px-5 py-3">
                                <button
                                    onClick={onLoadMore}
                                    className="w-full py-2 rounded-lg bg-gray-50 dark:bg-neutral-800 text-xs font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors"
                                >
                                    Load more
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

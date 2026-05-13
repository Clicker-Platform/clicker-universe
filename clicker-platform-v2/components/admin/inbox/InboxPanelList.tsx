'use client';

import { memo, useMemo, useState } from 'react';
import { Inbox, Mail, MailOpen, Search, X, Archive, Trash2, CheckSquare, Square } from 'lucide-react';
import { Submission } from '@/data/mockData';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
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
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onClearSelection: () => void;
    onBulkAction: (action: 'read' | 'archived' | 'delete') => void;
    bulkLoading: boolean;
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

function matchesSearch(sub: Submission, needle: string): boolean {
    if (!needle) return true;
    const n = needle.toLowerCase();
    if (sub.formTitle?.toLowerCase().includes(n)) return true;
    if (!sub.data) return false;
    for (const v of Object.values(sub.data)) {
        if (v == null) continue;
        if (String(v).toLowerCase().includes(n)) return true;
    }
    return false;
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
    selectedIds,
    onToggleSelect,
    onClearSelection,
    onBulkAction,
    bulkLoading,
}: InboxPanelListProps) {
    const [search, setSearch] = useState('');
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

    const filtered = useMemo(() => {
        return submissions
            .filter(sub => (filterStatus === 'all' ? sub.status !== 'archived' : sub.status === filterStatus))
            .filter(sub => matchesSearch(sub, search));
    }, [submissions, filterStatus, search]);

    const counts = {
        all: statusCounts.new + statusCounts.read,
        new: statusCounts.new,
        read: statusCounts.read,
        archived: statusCounts.archived,
    };

    const allVisibleSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
    const hasSelection = selectedIds.size > 0;

    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            onClearSelection();
        } else {
            // Add all visible to selection
            filtered.forEach(s => {
                if (!selectedIds.has(s.id)) onToggleSelect(s.id);
            });
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Filters */}
            <div className="px-4 pt-3 pb-1 shrink-0">
                <InboxFilters
                    currentFilter={filterStatus}
                    onFilterChange={onFilterChange}
                    counts={counts}
                    compact
                />
            </div>

            {/* Search */}
            <div className="px-4 pb-2 shrink-0">
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search loaded submissions…"
                        className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-brand-dark dark:text-neutral-200 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-brand-dark dark:focus:border-neutral-500"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 dark:text-neutral-600 hover:text-brand-dark dark:hover:text-neutral-200"
                            title="Clear search"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk action bar */}
            {hasSelection && (
                <div className="flex items-center justify-between gap-2 px-4 py-2 bg-brand-dark dark:bg-neutral-100 text-white dark:text-neutral-900 shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClearSelection}
                            className="p-1 rounded hover:bg-white/10 dark:hover:bg-black/10"
                            title="Clear selection"
                        >
                            <X size={14} />
                        </button>
                        <span className="text-xs font-bold">{selectedIds.size} selected</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onBulkAction('read')}
                            disabled={bulkLoading}
                            title="Mark as read"
                            className="p-1.5 rounded hover:bg-white/10 dark:hover:bg-black/10 disabled:opacity-40"
                        >
                            <MailOpen size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onBulkAction('archived')}
                            disabled={bulkLoading}
                            title="Archive"
                            className="p-1.5 rounded hover:bg-white/10 dark:hover:bg-black/10 disabled:opacity-40"
                        >
                            <Archive size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowBulkDeleteConfirm(true)}
                            disabled={bulkLoading}
                            title="Delete"
                            className="p-1.5 rounded hover:bg-red-500/30 disabled:opacity-40"
                        >
                            <Trash2 size={14} />
                        </button>
                        <ConfirmationDialog
                            isOpen={showBulkDeleteConfirm}
                            title={`Delete ${selectedIds.size} submission${selectedIds.size === 1 ? '' : 's'}`}
                            message="These submissions will be permanently deleted. This action cannot be undone."
                            confirmLabel="Delete"
                            isLoading={bulkLoading}
                            onConfirm={() => {
                                setShowBulkDeleteConfirm(false);
                                onBulkAction('delete');
                            }}
                            onCancel={() => setShowBulkDeleteConfirm(false)}
                        />
                    </div>
                </div>
            )}

            {/* Select-all row (when there are visible items) */}
            {filtered.length > 0 && (
                <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    className="flex items-center gap-2 px-5 py-2 text-[11px] font-bold text-gray-400 dark:text-neutral-600 hover:text-brand-dark dark:hover:text-neutral-200 border-b border-gray-100 dark:border-neutral-800 shrink-0"
                >
                    {allVisibleSelected
                        ? <CheckSquare size={13} className="text-brand-dark dark:text-neutral-200" />
                        : <Square size={13} />}
                    <span>{allVisibleSelected ? 'Deselect all' : 'Select all'}</span>
                </button>
            )}

            {/* Submission rows */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-neutral-600 py-16">
                        <Inbox size={32} className="opacity-40" />
                        <p className="text-sm font-bold">
                            {search
                                ? 'No matches'
                                : filterStatus === 'archived' ? 'No archived items' : 'No submissions yet'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {filtered.map((sub) => {
                            const isNew = sub.status === 'new';
                            const isLoading = loadingId === sub.id;
                            const isSelected = selectedIds.has(sub.id);
                            const fields = sub.fieldLabels
                                ? Object.entries(sub.fieldLabels).slice(0, 3)
                                : Object.entries(sub.data || {}).slice(0, 3);

                            return (
                                <div
                                    key={sub.id}
                                    onClick={() => onSelect(sub.id)}
                                    className={`w-full text-left px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer ${isSelected ? 'bg-brand-green/10 dark:bg-brand-green/5' : isNew ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleSelect(sub.id);
                                                }}
                                                title={isSelected ? 'Deselect' : 'Select'}
                                                className="mt-0.5 shrink-0 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800"
                                            >
                                                {isSelected
                                                    ? <CheckSquare size={14} className="text-brand-dark dark:text-neutral-200" />
                                                    : <Square size={14} className="text-gray-300 dark:text-neutral-700" />}
                                            </button>
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
                                                        }).filter(Boolean).join(' · ')}
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
                        {hasMore && !search && (
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

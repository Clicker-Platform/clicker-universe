'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Inbox } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { toast } from 'sonner';
import { auth, db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { useInboxPanel } from '@/lib/inbox-panel-context';
import { Submission, Form } from '@/data/mockData';
import { InboxPanelList } from './InboxPanelList';
import { InboxPanelDetail } from './InboxPanelDetail';

const BATCH_SIZE = 50;

export function InboxPanel() {
    const { siteId } = useSite();
    const { isOpen, close, filterStatus, setFilter, selectedSubmissionId, selectSubmission } = useInboxPanel();

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [formFieldMap, setFormFieldMap] = useState<Record<string, Record<string, string>>>({});
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [itemLimit, setItemLimit] = useState(BATCH_SIZE);
    const [statusCounts, setStatusCounts] = useState<Record<'new' | 'read' | 'archived', number>>({
        new: 0,
        read: 0,
        archived: 0,
    });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    // Tracks optimistic status overrides while API writes are in-flight
    const pendingUpdates = useRef<Map<string, string>>(new Map());

    // Clear selection when filter changes or detail view opens
    useEffect(() => {
        setSelectedIds(new Set());
    }, [filterStatus, selectedSubmissionId]);

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    // Live-subscribe to forms so field labels stay fresh when tenants edit form schemas
    useEffect(() => {
        if (!isOpen || !siteId || siteId === 'default' || siteId === 'pending') return;
        const unsub = onSnapshot(collection(db, 'sites', siteId, 'forms'), (snap) => {
            const map: Record<string, Record<string, string>> = {};
            snap.docs.forEach(doc => {
                const formData = doc.data() as Form;
                if (formData.fields && Array.isArray(formData.fields)) {
                    const fieldMap: Record<string, string> = {};
                    formData.fields.forEach((field: any) => {
                        if (field.id && field.label) {
                            fieldMap[field.id] = field.label;
                        }
                    });
                    map[doc.id] = fieldMap;
                }
            });
            setFormFieldMap(map);
        });
        return () => unsub();
    }, [isOpen, siteId]);

    // Real-time submissions listener
    useEffect(() => {
        if (!isOpen || !siteId || siteId === 'default' || siteId === 'pending') return;
        const q = query(
            collection(db, 'sites', siteId, 'inbox'),
            orderBy('submittedAt', 'desc'),
            limit(itemLimit)
        );
        const unsub = onSnapshot(q, (snap) => {
            setSubmissions(snap.docs.map(d => {
                const data = { id: d.id, ...d.data() } as Submission;
                const pending = pendingUpdates.current.get(d.id);
                return pending ? { ...data, status: pending as Submission['status'] } : data;
            }));
        });
        return () => unsub();
    }, [isOpen, siteId, itemLimit]);

    // Refresh accurate per-status counts from the server. Uses getCountFromServer
    // (a single aggregated query per status) so chip counts are correct even when
    // the loaded batch is smaller than the total.
    const refreshCounts = useCallback(async () => {
        if (!siteId || siteId === 'default' || siteId === 'pending') return;
        try {
            const coll = collection(db, 'sites', siteId, 'inbox');
            const [n, r, a] = await Promise.all([
                getCountFromServer(query(coll, where('status', '==', 'new'))),
                getCountFromServer(query(coll, where('status', '==', 'read'))),
                getCountFromServer(query(coll, where('status', '==', 'archived'))),
            ]);
            setStatusCounts({
                new: n.data().count,
                read: r.data().count,
                archived: a.data().count,
            });
        } catch (error) {
            console.error('Failed to refresh inbox counts:', error);
        }
    }, [siteId]);

    useEffect(() => {
        if (!isOpen) return;
        refreshCounts();
    }, [isOpen, refreshCounts]);

    // A3: if the currently-selected submission disappears from the live list
    // (deleted by another admin, archived from a different filter, etc.),
    // close the detail view and notify the user.
    const lastSelectedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!selectedSubmissionId) {
            lastSelectedRef.current = null;
            return;
        }
        // Only react after the listener has actually delivered data
        if (submissions.length === 0) return;
        const stillPresent = submissions.some(s => s.id === selectedSubmissionId);
        if (!stillPresent && lastSelectedRef.current === selectedSubmissionId) {
            toast.info('This submission was removed');
            selectSubmission(null);
        }
        lastSelectedRef.current = selectedSubmissionId;
    }, [selectedSubmissionId, submissions, selectSubmission]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, close]);

    const handleAction = useCallback(async (id: string, action: string) => {
        setLoadingId(id);

        // Capture previous status for rollback on failure
        let previousStatus: Submission['status'] | undefined;

        if (action !== 'delete') {
            pendingUpdates.current.set(id, action);
            setSubmissions(prev => prev.map(s => {
                if (s.id !== id) return s;
                previousStatus = s.status;
                return { ...s, status: action as Submission['status'] };
            }));
        }

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token || !siteId) {
                throw new Error('Not authenticated');
            }
            const res = await fetch('/api/submissions/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-site-id': siteId,
                },
                body: JSON.stringify({ id, action }),
            });

            if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`);
            }

            if (action === 'delete') {
                setSubmissions(prev => prev.filter(s => s.id !== id));
                if (selectedSubmissionId === id) selectSubmission(null);
                toast.success('Submission deleted');
            } else if (action === 'archived') {
                toast.success('Submission archived');
            }
            refreshCounts();
        } catch (error) {
            console.error('Error updating submission:', error);
            // Roll back optimistic update
            if (action !== 'delete' && previousStatus) {
                const restored = previousStatus;
                setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: restored } : s));
            }
            const label =
                action === 'delete' ? 'delete submission' :
                action === 'archived' ? 'archive submission' :
                action === 'read' ? 'mark as read' :
                action === 'new' ? 'mark as unread' :
                'update submission';
            toast.error(`Failed to ${label}. Please try again.`);
        } finally {
            pendingUpdates.current.delete(id);
            setLoadingId(null);
        }
    }, [siteId, selectedSubmissionId, selectSubmission, refreshCounts]);

    const handleMarkRead = useCallback(async (id: string) => {
        await handleAction(id, 'read');
    }, [handleAction]);

    const handleBulkAction = useCallback(async (action: 'read' | 'archived' | 'delete') => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        setBulkLoading(true);

        // Snapshot previous statuses for rollback (status changes only)
        const previousById = new Map<string, Submission['status']>();
        if (action !== 'delete') {
            ids.forEach(id => pendingUpdates.current.set(id, action));
            setSubmissions(prev => prev.map(s => {
                if (!selectedIds.has(s.id)) return s;
                previousById.set(s.id, s.status);
                return { ...s, status: action as Submission['status'] };
            }));
        }

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token || !siteId) throw new Error('Not authenticated');

            const res = await fetch('/api/submissions/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-site-id': siteId,
                },
                body: JSON.stringify({ ids, action }),
            });
            if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

            if (action === 'delete') {
                setSubmissions(prev => prev.filter(s => !selectedIds.has(s.id)));
                if (selectedSubmissionId && selectedIds.has(selectedSubmissionId)) {
                    selectSubmission(null);
                }
                toast.success(`Deleted ${ids.length} submission${ids.length === 1 ? '' : 's'}`);
            } else if (action === 'archived') {
                toast.success(`Archived ${ids.length} submission${ids.length === 1 ? '' : 's'}`);
            } else if (action === 'read') {
                toast.success(`Marked ${ids.length} as read`);
            }
            clearSelection();
            refreshCounts();
        } catch (error) {
            console.error('Bulk action failed:', error);
            if (action !== 'delete' && previousById.size > 0) {
                setSubmissions(prev => prev.map(s => {
                    const restored = previousById.get(s.id);
                    return restored ? { ...s, status: restored } : s;
                }));
            }
            const label =
                action === 'delete' ? 'delete' :
                action === 'archived' ? 'archive' :
                'mark as read';
            toast.error(`Failed to ${label} selected submissions. Please try again.`);
        } finally {
            ids.forEach(id => pendingUpdates.current.delete(id));
            setBulkLoading(false);
        }
    }, [selectedIds, siteId, selectedSubmissionId, selectSubmission, clearSelection, refreshCounts]);

    const handleLoadMore = useCallback(() => {
        setItemLimit(prev => prev + BATCH_SIZE);
    }, []);

    if (!isOpen) return null;

    const selectedSubmission = selectedSubmissionId
        ? submissions.find(s => s.id === selectedSubmissionId) ?? null
        : null;

    const newCount = statusCounts.new;
    // Sidebar is gone on desktop — panel always starts from the left edge
    const leftOffset = 'md:left-0';

    return (
        <>
            {/* Backdrop — sits behind the panel */}
            <div
                className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 md:bg-transparent md:dark:bg-transparent"
                onClick={close}
            />

            {/* Panel — above the backdrop */}
            <div className={`fixed inset-y-0 left-0 ${leftOffset} z-50 w-[360px] bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 shadow-[10px_0_20px_-5px_rgba(0,0,0,0.1)] dark:shadow-[10px_0_20px_-5px_rgba(0,0,0,0.3)] flex flex-col`}>
                {/* Panel header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <Inbox size={18} className="text-brand-dark dark:text-neutral-200" />
                        <span className="font-bold text-brand-dark dark:text-neutral-100 text-base">Inbox</span>
                        {newCount > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                                {newCount}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={close}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content area — list or detail */}
                <div className="flex-1 min-h-0">
                    {selectedSubmission ? (
                        <InboxPanelDetail
                            submission={selectedSubmission}
                            formFieldMap={formFieldMap}
                            loadingId={loadingId}
                            onBack={() => selectSubmission(null)}
                            onAction={handleAction}
                        />
                    ) : (
                        <InboxPanelList
                            submissions={submissions}
                            statusCounts={statusCounts}
                            filterStatus={filterStatus}
                            onFilterChange={setFilter}
                            onSelect={(id) => {
                                // Auto-mark as read when opening detail
                                const sub = submissions.find(s => s.id === id);
                                if (sub?.status === 'new') {
                                    handleMarkRead(id);
                                }
                                selectSubmission(id);
                            }}
                            onMarkRead={handleMarkRead}
                            loadingId={loadingId}
                            itemLimit={itemLimit}
                            onLoadMore={handleLoadMore}
                            hasMore={submissions.length >= itemLimit}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            onClearSelection={clearSelection}
                            onBulkAction={handleBulkAction}
                            bulkLoading={bulkLoading}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

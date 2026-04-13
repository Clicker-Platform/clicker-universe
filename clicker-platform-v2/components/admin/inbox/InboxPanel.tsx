'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Inbox } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { useInboxPanel } from '@/lib/inbox-panel-context';
import { Submission, Form } from '@/data/mockData';
import { InboxPanelList } from './InboxPanelList';
import { InboxPanelDetail } from './InboxPanelDetail';

const BATCH_SIZE = 50;

export function InboxPanel({ sidebarCollapsed }: { sidebarCollapsed?: boolean }) {
    const { siteId } = useSite();
    const { isOpen, close, filterStatus, setFilter, selectedSubmissionId, selectSubmission } = useInboxPanel();

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [formFieldMap, setFormFieldMap] = useState<Record<string, Record<string, string>>>({});
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [itemLimit, setItemLimit] = useState(BATCH_SIZE);
    const formsFetched = useRef(false);

    // Fetch form field map once
    useEffect(() => {
        if (!isOpen || !siteId || siteId === 'default' || siteId === 'pending' || formsFetched.current) return;
        formsFetched.current = true;

        getDocs(collection(db, 'sites', siteId, 'forms')).then((snap) => {
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
            setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
        });
        return () => unsub();
    }, [isOpen, siteId, itemLimit]);

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
        try {
            const res = await fetch('/api/submissions/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action, siteId }),
            });
            if (res.ok) {
                if (action === 'delete') {
                    setSubmissions(prev => prev.filter(s => s.id !== id));
                    if (selectedSubmissionId === id) selectSubmission(null);
                } else {
                    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: action as Submission['status'] } : s));
                }
            }
        } catch (error) {
            console.error('Error updating submission:', error);
        } finally {
            setLoadingId(null);
        }
    }, [siteId, selectedSubmissionId, selectSubmission]);

    const handleMarkRead = useCallback(async (id: string) => {
        await handleAction(id, 'read');
    }, [handleAction]);

    const handleLoadMore = useCallback(() => {
        setItemLimit(prev => prev + BATCH_SIZE);
    }, []);

    if (!isOpen) return null;

    const selectedSubmission = selectedSubmissionId
        ? submissions.find(s => s.id === selectedSubmissionId) ?? null
        : null;

    const newCount = submissions.filter(s => s.status === 'new').length;
    const leftOffset = sidebarCollapsed ? 'md:left-14' : 'md:left-56';

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[199] bg-black/20 dark:bg-black/40 md:bg-transparent md:dark:bg-transparent"
                onClick={close}
            />

            {/* Panel */}
            <div className={`fixed inset-y-0 left-0 ${leftOffset} z-40 w-[360px] bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 shadow-xl flex flex-col`}>
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
                        />
                    )}
                </div>
            </div>
        </>
    );
}

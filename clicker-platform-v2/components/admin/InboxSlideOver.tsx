'use client';

import { useEffect, useState } from 'react';
import { X, Inbox, ExternalLink, Mail, MailOpen } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Submission } from '@/data/mockData';

interface InboxSlideOverProps {
    onClose: () => void;
    siteId: string;
    baseUrl: string;
    sidebarCollapsed?: boolean;
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

export function InboxSlideOver({ onClose, siteId, baseUrl, sidebarCollapsed }: InboxSlideOverProps) {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    useEffect(() => {
        if (!siteId || siteId === 'default' || siteId === 'pending') return;
        const q = query(
            collection(db, 'sites', siteId, 'inbox'),
            orderBy('submittedAt', 'desc'),
            limit(20)
        );
        const unsub = onSnapshot(q, (snap) => {
            setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
        });
        return () => unsub();
    }, [siteId]);

    const handleMarkRead = async (id: string) => {
        setLoadingId(id);
        try {
            await fetch('/api/submissions/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action: 'mark-as-read', siteId }),
            });
            setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'read' } : s));
        } finally {
            setLoadingId(null);
        }
    };

    const nonArchived = submissions.filter(s => s.status !== 'archived');
    const newCount = submissions.filter(s => s.status === 'new').length;

    const leftOffset = sidebarCollapsed ? 'md:left-16' : 'md:left-64';

    return (
        <>
            {/* Backdrop (mobile only or partial) */}
            <div
                className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 md:bg-transparent md:dark:bg-transparent"
                onClick={onClose}
            />

            {/* Panel — sits right next to sidebar on desktop */}
            <div className={`fixed inset-y-0 left-0 ${leftOffset} z-50 w-[360px] bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 shadow-xl flex flex-col`}>
                {/* Header */}
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
                    <div className="flex items-center gap-2">
                        <Link
                            href={`${baseUrl}/admin/inbox`}
                            onClick={onClose}
                            className="text-xs font-bold text-gray-400 dark:text-neutral-500 hover:text-brand-dark dark:hover:text-neutral-200 flex items-center gap-1 transition-colors"
                        >
                            View all <ExternalLink size={12} />
                        </Link>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Submissions list */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {nonArchived.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-neutral-600 py-16">
                            <Inbox size={32} className="opacity-40" />
                            <p className="text-sm font-bold">No submissions yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                            {nonArchived.map((sub) => {
                                const isNew = sub.status === 'new';
                                const isLoading = loadingId === sub.id;
                                const fields = sub.fieldLabels
                                    ? Object.entries(sub.fieldLabels).slice(0, 3)
                                    : Object.entries(sub.data || {}).slice(0, 3);

                                return (
                                    <div
                                        key={sub.id}
                                        className={`px-5 py-4 transition-colors ${isNew ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}
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
                                                        onClick={() => handleMarkRead(sub.id)}
                                                        disabled={isLoading}
                                                        title="Mark as read"
                                                        className="p-1 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors disabled:opacity-40"
                                                    >
                                                        <MailOpen size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer link */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 shrink-0">
                    <Link
                        href={`${baseUrl}/admin/inbox`}
                        onClick={onClose}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-800 text-sm font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors"
                    >
                        Open full Inbox <ExternalLink size={13} />
                    </Link>
                </div>
            </div>
        </>
    );
}

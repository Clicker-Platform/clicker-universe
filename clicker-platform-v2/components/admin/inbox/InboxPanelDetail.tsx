'use client';

import { memo, useState } from 'react';
import { ArrowLeft, Clock, Mail, MailOpen, Archive, ArchiveRestore, Trash2, Download, ExternalLink } from 'lucide-react';
import { Submission } from '@/data/mockData';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

interface InboxPanelDetailProps {
    submission: Submission;
    formFieldMap: Record<string, Record<string, string>>;
    loadingId: string | null;
    onBack: () => void;
    onAction: (id: string, action: string) => void;
}

const isImageUrl = (url: string) => {
    if (typeof url !== 'string') return false;
    if (url.includes('firebasestorage.googleapis.com')) return true;
    return /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);
};

function formatDetailDate(ts: any): string {
    if (!ts) return 'Unknown';
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
}

export const InboxPanelDetail = memo(function InboxPanelDetail({
    submission: sub,
    formFieldMap,
    loadingId,
    onBack,
    onAction,
}: InboxPanelDetailProps) {
    const isLoading = loadingId === sub.id;
    const isNew = sub.status === 'new';
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-neutral-800 shrink-0">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors"
                >
                    <ArrowLeft size={16} />
                </button>
                <span className="text-sm font-bold text-brand-dark dark:text-neutral-100 truncate flex-1">
                    {sub.formTitle || 'Submission'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                    sub.status === 'new' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    sub.status === 'archived' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
                }`}>
                    {sub.status}
                </span>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-1 px-5 py-2 border-b border-gray-100 dark:border-neutral-800 shrink-0">
                {isNew && (
                    <button
                        onClick={() => onAction(sub.id, 'read')}
                        disabled={isLoading}
                        title="Mark as read"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors disabled:opacity-40"
                    >
                        <MailOpen size={13} /> Mark read
                    </button>
                )}
                {!isNew && sub.status === 'read' && (
                    <button
                        onClick={() => onAction(sub.id, 'new')}
                        disabled={isLoading}
                        title="Mark as unread"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors disabled:opacity-40"
                    >
                        <Mail size={13} /> Mark unread
                    </button>
                )}
                {sub.status !== 'archived' ? (
                    <button
                        onClick={() => onAction(sub.id, 'archived')}
                        disabled={isLoading}
                        title="Archive"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-500 dark:text-neutral-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-40"
                    >
                        <Archive size={13} /> Archive
                    </button>
                ) : (
                    <button
                        onClick={() => onAction(sub.id, 'new')}
                        disabled={isLoading}
                        title="Unarchive"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-500 dark:text-neutral-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-40"
                    >
                        <ArchiveRestore size={13} /> Unarchive
                    </button>
                )}
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading}
                    title="Delete"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40 ml-auto"
                >
                    <Trash2 size={13} /> Delete
                </button>
                <ConfirmationDialog
                    isOpen={showDeleteConfirm}
                    title="Delete Submission"
                    message="This submission will be permanently deleted. This action cannot be undone."
                    confirmLabel="Delete"
                    onConfirm={() => {
                        setShowDeleteConfirm(false);
                        onAction(sub.id, 'delete');
                    }}
                    onCancel={() => setShowDeleteConfirm(false)}
                    isLoading={isLoading}
                />
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2 px-5 py-2.5 text-xs text-gray-400 dark:text-neutral-500 font-bold border-b border-gray-50 dark:border-neutral-800/50 shrink-0">
                <Clock size={12} />
                <span suppressHydrationWarning>{formatDetailDate(sub.submittedAt)}</span>
            </div>

            {/* Field data */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4">
                <div className="space-y-4">
                    {Object.entries(sub.data || {})
                        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                        .map(([key, value], index) => {
                            const snapshotLabel = sub.fieldLabels?.[key];
                            let label = snapshotLabel || formFieldMap[sub.formId]?.[key];
                            if (!label) {
                                label = /^\d{10,}$/.test(key) ? `Field ${index + 1}` : key;
                            }

                            const stringValue = String(value);
                            const isImage = isImageUrl(stringValue);

                            return (
                                <div key={key}>
                                    <p className="text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase mb-1">{label}</p>
                                    {isImage ? (
                                        <div className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                                            <img src={stringValue} alt={label} className="w-full h-auto object-cover max-h-[240px]" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                <a
                                                    href={stringValue}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 bg-white dark:bg-neutral-800 rounded-full text-gray-700 dark:text-neutral-300 hover:text-brand-dark dark:hover:text-neutral-100 hover:scale-110 transition-all shadow-lg"
                                                    title="Open in new tab"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                                <a
                                                    href={stringValue}
                                                    download
                                                    className="p-2 bg-brand-green rounded-full text-brand-dark hover:scale-110 transition-all shadow-lg"
                                                    title="Download"
                                                >
                                                    <Download size={16} />
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-medium text-brand-dark dark:text-neutral-200 break-words">
                                            {typeof value === 'object' ? JSON.stringify(value) : stringValue}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
});

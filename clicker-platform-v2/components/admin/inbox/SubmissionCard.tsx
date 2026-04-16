import { memo } from 'react';
import { Clock, Trash2, Archive, Download, ExternalLink } from 'lucide-react';
import { Submission } from '@/data/mockData';

interface SubmissionCardProps {
    submission: Submission;
    formFieldMap: Record<string, Record<string, string>>;
    loadingId: string | null;
    onAction: (id: string, action: string) => void;
}

const isImageUrl = (url: string) => {
    if (typeof url !== 'string') return false;
    // Check for Firebase Storage URLs specifically or common image extensions
    if (url.includes('firebasestorage.googleapis.com')) return true;
    return /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);
};

export const SubmissionCard = memo(function SubmissionCard({
    submission: sub,
    formFieldMap,
    loadingId,
    onAction
}: SubmissionCardProps) {

    return (
        <div className="p-6 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors group cursor-default">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (sub.status === 'new') {
                                onAction(sub.id, 'read');
                            }
                        }}
                        disabled={loadingId === sub.id || sub.status !== 'new'}
                        className={`p-2 rounded-full transition-all ${sub.status === 'new' ? 'hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer' : 'cursor-default'} ${loadingId === sub.id ? 'opacity-50' : ''}`}
                        title={sub.status === 'new' ? "Mark as read" : undefined}
                    >
                        {sub.status === 'new' ? (
                            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                        ) : (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" />
                        )}
                    </button>
                    <h3 className={`text-lg text-brand-dark dark:text-neutral-200 ${sub.status === 'new' ? 'font-extrabold' : 'font-medium'}`}>
                        {sub.formTitle || 'Unknown Form'}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${sub.status === 'new' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        sub.status === 'archived' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}>
                        {sub.status}
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-400 dark:text-neutral-500 text-sm font-bold">
                        <Clock size={14} />
                        <span suppressHydrationWarning>
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Unknown'}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        {sub.status !== 'archived' && (
                            <button
                                onClick={() => onAction(sub.id, 'archived')}
                                disabled={loadingId === sub.id}
                                className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-400 dark:text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg transition-colors"
                                title="Archive"
                            >
                                <Archive size={18} />
                            </button>
                        )}
                        {sub.status === 'archived' && (
                            <button
                                onClick={() => onAction(sub.id, 'new')}
                                disabled={loadingId === sub.id}
                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 dark:text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                                title="Move to Inbox"
                            >
                                <Archive size={18} />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (confirm('Are you sure you want to delete this submission?')) {
                                    onAction(sub.id, 'delete');
                                }
                            }}
                            disabled={loadingId === sub.id}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-lg p-4 border border-gray-100 dark:border-neutral-800 ml-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(sub.data || {})
                        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                        .map(([key, value], index) => {
                            const snapshotLabel = sub.fieldLabels?.[key];
                            let label = snapshotLabel || formFieldMap[sub.formId]?.[key];

                            if (!label) {
                                if (/^\d{10,}$/.test(key)) {
                                    label = `Field ${index + 1}`;
                                } else {
                                    label = key;
                                }
                            }

                            const stringValue = String(value);
                            const isImage = isImageUrl(stringValue);

                            return (
                                <div key={key}>
                                    <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase mb-1">{label}</p>
                                    {isImage ? (
                                        <div className="mt-2 group relative max-w-[200px] rounded-lg overflow-hidden border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                                            <img src={stringValue} alt={label} className="w-full h-auto object-cover max-h-[200px]" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                <a
                                                    href={stringValue}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 bg-white dark:bg-neutral-800 rounded-full text-gray-700 dark:text-neutral-300 hover:text-brand-dark dark:hover:text-neutral-100 hover:scale-110 transition-all shadow-lg"
                                                    title="Open in new tab"
                                                >
                                                    <ExternalLink size={18} />
                                                </a>
                                                <a
                                                    href={stringValue}
                                                    download
                                                    className="p-2 bg-brand-green rounded-full text-brand-dark hover:scale-110 transition-all shadow-lg"
                                                    title="Download"
                                                >
                                                    <Download size={18} />
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="font-medium text-brand-dark dark:text-neutral-200 break-words">
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

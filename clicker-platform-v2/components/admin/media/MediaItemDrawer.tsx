'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { updateMedia } from '@/lib/media/library';
import type { MediaItem } from '@/lib/media/types';
import { DEFAULT_FOLDER } from '@/lib/media/types';

interface Props {
    item: MediaItem | null;
    siteId: string;
    onClose: () => void;
    onChange: (next: MediaItem) => void;
    onDelete?: (id: string) => void;
    deleting?: boolean;
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(ts: MediaItem['uploadedAt']): string {
    // Firestore Timestamp has toDate(); fall back to toMillis for the test mock shape.
    const d = typeof (ts as any).toDate === 'function'
        ? (ts as any).toDate()
        : new Date((ts as any).toMillis?.() ?? 0);
    return d.toISOString().slice(0, 10);
}

export function MediaItemDrawer({ item, siteId, onClose, onChange, onDelete, deleting }: Props) {
    const [fileName, setFileName] = useState('');
    const [folder, setFolder] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!item) return;
        setFileName(item.fileName);
        setFolder(item.folder);
        setTagsInput(item.tags.join(', '));
    }, [item]);

    if (!item) return null;

    const save = async () => {
        if (saving) return;
        setSaving(true);
        const patch = {
            fileName: fileName.trim(),
            folder: folder.trim() || DEFAULT_FOLDER,
            tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        };
        await updateMedia(siteId, item.id, patch);
        onChange({ ...item, ...patch });
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-y-0 right-0 z-40 w-[400px] bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-neutral-800">
                <span className="font-semibold text-sm truncate">{item.fileName}</span>
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.fileName} className="w-full rounded-lg" />
                <label className="block text-xs font-medium text-neutral-500">Filename</label>
                <input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <label className="block text-xs font-medium text-neutral-500">Folder</label>
                <input
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <label className="block text-xs font-medium text-neutral-500">Tags (comma separated)</label>
                <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />

                <div className="pt-4">
                    <label className="block text-[11px] font-medium tracking-wider uppercase text-neutral-400 dark:text-neutral-500 mb-2">Metadata</label>
                    <dl className="text-xs">
                        {item.width && item.height && (
                            <div className="flex justify-between py-1.5 border-b border-dashed border-gray-100 dark:border-neutral-800">
                                <dt className="text-neutral-500">Dimensions</dt>
                                <dd className="font-mono text-neutral-700 dark:text-neutral-300">{item.width} × {item.height}</dd>
                            </div>
                        )}
                        <div className="flex justify-between py-1.5 border-b border-dashed border-gray-100 dark:border-neutral-800">
                            <dt className="text-neutral-500">Size</dt>
                            <dd className="font-mono text-neutral-700 dark:text-neutral-300">{formatBytes(item.sizeBytes)}</dd>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-dashed border-gray-100 dark:border-neutral-800">
                            <dt className="text-neutral-500">Type</dt>
                            <dd className="font-mono text-neutral-700 dark:text-neutral-300">{item.mimeType}</dd>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-dashed border-gray-100 dark:border-neutral-800">
                            <dt className="text-neutral-500">Uploaded</dt>
                            <dd className="font-mono text-neutral-700 dark:text-neutral-300">{formatDate(item.uploadedAt)}</dd>
                        </div>
                        <div className="flex justify-between py-1.5">
                            <dt className="text-neutral-500">By</dt>
                            <dd className="font-mono text-neutral-700 dark:text-neutral-300 truncate ml-2 max-w-[180px]" title={item.uploadedBy}>{item.uploadedBy}</dd>
                        </div>
                    </dl>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
                {onDelete ? (
                    <button
                        onClick={() => onDelete(item.id)}
                        disabled={deleting}
                        className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white flex items-center gap-1 hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Delete
                    </button>
                ) : <span />}
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white flex items-center gap-1 hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {saving && <Loader2 size={12} className="animate-spin" />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

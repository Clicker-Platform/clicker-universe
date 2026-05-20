'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Upload as UploadIcon, Loader2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import { registerMedia, listMedia } from '@/lib/media/library';
import { logger } from '@/lib/logger-edge';
import type { MediaItem } from '@/lib/media/types';
import { MediaLibraryGrid } from './MediaLibraryGrid';

interface MediaPickerProps {
    open: boolean;
    onClose: () => void;
    onSelect: (result: { url: string; item?: MediaItem }) => void;
    accept?: 'image' | 'all';
    initialFolder?: string;
}

type Tab = 'library' | 'upload' | 'url';

export function MediaPicker({ open, onClose, onSelect, accept = 'image', initialFolder }: MediaPickerProps) {
    const { siteId } = useSite();
    const [tab, setTab] = useState<Tab>('library');
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadBusy, setUploadBusy] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        // Reset per-session state so reopening doesn't carry over stale URL input or error.
        setUrlInput('');
        setError('');
        setLoading(true);
        let cancelled = false;
        listMedia({ siteId, folder: initialFolder })
            .then((data) => { if (!cancelled) setItems(data); })
            .catch((e) => {
                if (cancelled) return;
                logger.error('admin.media.picker.load', { error: e });
                setError(e.message);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, siteId, initialFolder]);

    if (!open) return null;

    const acceptAttr = accept === 'image' ? 'image/*' : '*/*';

    const handleFile = async (file: File) => {
        if (!file) return;
        setUploadBusy(true);
        setError('');
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error('Not authenticated');
            const item = await registerMedia({ siteId, file, uploadedBy: uid });
            setItems((prev) => [item, ...prev]);
            onSelect({ url: item.url, item });
            onClose();
        } catch (e: any) {
            logger.error('admin.media.picker.upload', { error: e });
            setError(e.message || 'Upload failed');
        } finally {
            setUploadBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="w-[800px] max-w-[95vw] max-h-[85vh] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <ImageIcon size={16} className="text-neutral-500" />
                        <span className="font-semibold text-sm">Media</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
                    {(['library', 'upload', 'url'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2 text-sm capitalize transition-colors ${
                                tab === t
                                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                            }`}
                        >
                            {t === 'url' ? 'URL' : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {tab === 'library' && (
                        loading ? (
                            <div className="flex items-center justify-center h-64 text-neutral-500">
                                <Loader2 className="animate-spin" size={24} />
                            </div>
                        ) : (
                            <>
                                {error && (
                                    <p className="px-4 pt-3 text-sm text-red-500">{error}</p>
                                )}
                                <MediaLibraryGrid
                                    items={items}
                                    onSelect={(item) => { onSelect({ url: item.url, item }); onClose(); }}
                                    emptyMessage={error ? 'Could not load media.' : undefined}
                                />
                            </>
                        )
                    )}

                    {tab === 'upload' && (
                        <div className="p-6">
                            <input
                                ref={fileRef}
                                type="file"
                                accept={acceptAttr}
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                            />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploadBusy}
                                className="w-full py-12 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {uploadBusy
                                    ? <Loader2 className="animate-spin" size={24} />
                                    : <UploadIcon size={24} className="text-neutral-400" />
                                }
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    {uploadBusy ? 'Uploading…' : 'Click to upload an image'}
                                </span>
                            </button>
                            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                        </div>
                    )}

                    {tab === 'url' && (
                        <div className="p-6 space-y-3">
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                External URL
                            </label>
                            <div className="flex items-center gap-2">
                                <LinkIcon size={16} className="text-neutral-400 flex-shrink-0" />
                                <input
                                    type="url"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://…"
                                    className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                />
                                <button
                                    type="button"
                                    disabled={!urlInput.trim()}
                                    onClick={() => { onSelect({ url: urlInput.trim() }); onClose(); }}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                                >
                                    Use URL
                                </button>
                            </div>
                            <p className="text-xs text-neutral-500">External URLs are not added to the library.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

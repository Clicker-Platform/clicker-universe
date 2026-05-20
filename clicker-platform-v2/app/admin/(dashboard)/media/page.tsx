'use client';

import { useEffect, useState } from 'react';
import { Upload as UploadIcon, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import {
    listMedia, deleteMedia, importExistingMedia, registerMedia,
} from '@/lib/media/library';
import { MediaInUseError } from '@/lib/media/types';
import type { MediaItem, MediaUsage } from '@/lib/media/types';
import { MediaLibraryGrid } from '@/components/admin/media/MediaLibraryGrid';
import { MediaItemDrawer } from '@/components/admin/media/MediaItemDrawer';
import { MediaUsageModal } from '@/components/admin/media/MediaUsageModal';

export default function MediaPage() {
    const { siteId } = useSite();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [active, setActive] = useState<MediaItem | null>(null);
    const [usageBlock, setUsageBlock] = useState<{ id: string; usages: MediaUsage[] } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const refresh = async () => {
        setLoading(true);
        const next = await listMedia({ siteId });
        setItems(next);
        setLoading(false);
    };
    useEffect(() => { refresh(); }, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-dismiss toast after 3 seconds
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }, [toast]);

    const onUpload = async (file: File) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        setBusy('upload');
        try {
            const item = await registerMedia({ siteId, file, uploadedBy: uid });
            setItems(prev => [item, ...prev]);
        } catch (e) {
            logger.error('admin.media.upload', { error: e });
            setToast((e as Error).message);
        } finally {
            setBusy(null);
        }
    };

    const onDelete = async (id: string, force = false) => {
        setBusy(`del-${id}`);
        try {
            await deleteMedia(siteId, id, { force });
            setItems(prev => prev.filter(i => i.id !== id));
            setUsageBlock(null);
            setActive(null);
        } catch (e) {
            if (e instanceof MediaInUseError) {
                setUsageBlock({ id, usages: e.usages });
            } else {
                logger.error('admin.media.delete', { error: e });
                setToast((e as Error).message);
            }
        } finally {
            setBusy(null);
        }
    };

    const onImport = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        setBusy('import');
        try {
            const res = await importExistingMedia(siteId, uid);
            setToast(`Imported ${res.imported} files, skipped ${res.skipped} orphans.`);
            await refresh();
        } catch (e) {
            logger.error('admin.media.import', { error: e });
            setToast((e as Error).message);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
                <h1 className="text-lg font-semibold">Media</h1>
                <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800 cursor-pointer">
                        {busy === 'upload' ? <Loader2 size={14} className="animate-spin" /> : <UploadIcon size={14} />} Upload
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                        />
                    </label>
                    <button
                        onClick={onImport}
                        disabled={busy === 'import'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800"
                    >
                        {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Import existing files
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center flex-1 text-neutral-500">
                    <Loader2 className="animate-spin" />
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <MediaLibraryGrid items={items} onSelect={setActive} selectedId={active?.id} />
                </div>
            )}

            <MediaItemDrawer
                item={active}
                siteId={siteId}
                onClose={() => setActive(null)}
                onChange={(next) => setItems(prev => prev.map(i => i.id === next.id ? next : i))}
            />

            {active && (
                <div className="fixed bottom-4 right-[420px] z-40">
                    <button
                        onClick={() => onDelete(active.id)}
                        disabled={busy === `del-${active.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-red-600 text-white disabled:opacity-60"
                    >
                        {busy === `del-${active.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Delete
                    </button>
                </div>
            )}

            <MediaUsageModal
                open={!!usageBlock}
                usages={usageBlock?.usages ?? []}
                onCancel={() => setUsageBlock(null)}
                onForceDelete={() => usageBlock && onDelete(usageBlock.id, true)}
            />

            {toast && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-neutral-900 text-white text-sm rounded-md shadow-lg z-50">
                    {toast}
                </div>
            )}
        </div>
    );
}

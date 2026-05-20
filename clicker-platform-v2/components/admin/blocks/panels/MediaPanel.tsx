'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { listMedia } from '@/lib/media/library';
import type { MediaItem } from '@/lib/media/types';
import { MediaLibraryGrid } from '@/components/admin/media/MediaLibraryGrid';

export function MediaPanel() {
    const { siteId } = useSite();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        listMedia({ siteId })
            .then((res) => { if (!cancelled) setItems(res); })
            .catch((e) => {
                if (cancelled) return;
                logger.error('admin.media.panel.load', { error: e });
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [siteId]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 1500);
        return () => clearTimeout(t);
    }, [toast]);

    const copyUrl = async (item: MediaItem) => {
        await navigator.clipboard.writeText(item.url);
        setToast('URL copied');
    };

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-neutral-800">
                <span className="text-xs text-neutral-500">Click an item to copy its URL.</span>
                <Link
                    href="/admin/media"
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                    Manage <ExternalLink size={11} />
                </Link>
            </div>
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="animate-spin text-neutral-400" size={20} />
                    </div>
                ) : (
                    <MediaLibraryGrid items={items} onSelect={copyUrl} />
                )}
            </div>
            {toast && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs rounded-md shadow-lg">
                    {toast}
                </div>
            )}
        </div>
    );
}

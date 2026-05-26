'use client';

import type { MediaItem } from '@/lib/media/types';
import { getDisplayThumbnail } from '@/lib/media/thumbnail';

interface Props {
    item: MediaItem;
    selected?: boolean;
    onClick?: () => void;
}

export function MediaItemCard({ item, selected, onClick }: Props) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={`group relative aspect-square overflow-hidden rounded-lg border bg-white dark:bg-neutral-900 transition-colors ${
                selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-200 dark:border-neutral-800 hover:border-blue-400'
            }`}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={getDisplayThumbnail(item)}
                alt={item.fileName}
                className="h-full w-full object-cover"
                loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <div className="truncate">{item.fileName}</div>
                {item.width && item.height && (
                    <div className="text-white/70">{item.width} × {item.height}</div>
                )}
            </div>
        </button>
    );
}

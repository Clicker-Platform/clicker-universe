'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { MediaItem } from '@/lib/media/types';
import { MediaItemCard } from './MediaItemCard';

interface Props {
    items: MediaItem[];
    onSelect: (item: MediaItem) => void;
    selectedId?: string;
    emptyMessage?: string;
}

export function MediaLibraryGrid({ items, onSelect, selectedId, emptyMessage }: Props) {
    const [search, setSearch] = useState('');
    const [folder, setFolder] = useState<string>('');
    const [tag, setTag] = useState<string>('');

    const folders = useMemo(() => Array.from(new Set(items.map(i => i.folder))).sort(), [items]);
    const tags = useMemo(() => Array.from(new Set(items.flatMap(i => i.tags))).sort(), [items]);

    // Clear filter selections that no longer correspond to any available option
    // (e.g. after items reload and the previously-selected folder is gone).
    useEffect(() => {
        if (folder && !folders.includes(folder)) setFolder('');
    }, [folders, folder]);
    useEffect(() => {
        if (tag && !tags.includes(tag)) setTag('');
    }, [tags, tag]);

    const filtered = useMemo(() => {
        return items.filter(i => {
            if (folder && i.folder !== folder) return false;
            if (tag && !i.tags.includes(tag)) return false;
            if (search && !i.fileName.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [items, folder, tag, search]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-neutral-800">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search filename…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                    />
                </div>
                <select value={folder} onChange={(e) => setFolder(e.target.value)} className="text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-1.5">
                    <option value="">All folders</option>
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={tag} onChange={(e) => setTag(e.target.value)} className="text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-1.5">
                    <option value="">All tags</option>
                    {tags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
                {filtered.length === 0 ? (
                    <div className="text-center text-sm text-neutral-500 py-8">
                        {emptyMessage || 'No media yet. Upload to get started.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {filtered.map(item => (
                            <MediaItemCard
                                key={item.id}
                                item={item}
                                selected={selectedId === item.id}
                                onClick={() => onSelect(item)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

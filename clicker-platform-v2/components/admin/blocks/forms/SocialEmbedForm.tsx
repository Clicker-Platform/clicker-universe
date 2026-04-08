'use client';

import { Plus, Trash2, Play } from 'lucide-react';

type Platform = 'tiktok' | 'instagram' | 'youtube';

interface SocialEmbedItem {
    url: string;
    platform: Platform | null;
    caption?: string;
}

interface SocialEmbedFormProps {
    data: any;
    onChange: (data: any) => void;
}

const inputClass = "w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

function detectPlatform(url: string): Platform | null {
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return null;
}

const platformBadge: Record<Platform, string> = {
    tiktok: 'bg-pink-500/20 text-pink-300 border-pink-500/20',
    instagram: 'bg-purple-500/20 text-purple-300 border-purple-500/20',
    youtube: 'bg-red-500/20 text-red-300 border-red-500/20',
};

const platformLabel: Record<Platform, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    youtube: 'YouTube',
};

export function SocialEmbedForm({ data, onChange }: SocialEmbedFormProps) {
    const safeData = data || {};
    const items: SocialEmbedItem[] = safeData.items || [];
    const limit: number = safeData.limit ?? 6;

    const handleItemChange = (index: number, field: keyof SocialEmbedItem, value: string) => {
        const newItems = [...items];
        const updated: SocialEmbedItem = { ...newItems[index], [field]: value };
        if (field === 'url') {
            updated.platform = detectPlatform(value);
        }
        newItems[index] = updated;
        onChange({ ...safeData, items: newItems });
    };

    const handleAddItem = () => {
        if (items.length >= 12) return;
        onChange({ ...safeData, items: [...items, { url: '', platform: null, caption: '' }] });
    };

    const handleDeleteItem = (index: number) => {
        onChange({ ...safeData, items: items.filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-4">
            {/* Title */}
            <div>
                <label className={labelClass}>Section Title (optional)</label>
                <input
                    type="text"
                    value={safeData.title || ''}
                    onChange={e => onChange({ ...safeData, title: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Follow us on TikTok"
                />
            </div>

            {/* Limit */}
            <div>
                <label className={labelClass}>Max embeds shown (1–12)</label>
                <input
                    type="number"
                    min={1}
                    max={12}
                    value={limit}
                    onChange={e => {
                        const val = Math.max(1, Math.min(12, parseInt(e.target.value) || 1));
                        onChange({ ...safeData, limit: val });
                    }}
                    className={inputClass}
                />
            </div>

            {/* Items */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className={labelClass}>Embeds ({items.length}/12)</label>
                    <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={items.length >= 12}
                        className="text-xs font-bold text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus size={14} /> Add Embed
                    </button>
                </div>

                {items.length === 0 && (
                    <div
                        onClick={handleAddItem}
                        className="text-center py-10 bg-gray-100/50 dark:bg-neutral-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 text-sm cursor-pointer hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800/50 transition-all group"
                    >
                        <Play size={24} className="mx-auto mb-2 opacity-30 group-hover:opacity-60 transition-opacity" />
                        <p className="font-bold text-neutral-500 dark:text-neutral-400">No embeds yet</p>
                        <p className="text-xs mt-1 opacity-60">Paste a TikTok, Instagram, or YouTube Shorts URL</p>
                    </div>
                )}

                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="p-4 bg-gray-100 dark:bg-neutral-800 rounded-2xl border border-gray-300 dark:border-neutral-700 relative group shadow-sm space-y-3">
                            {/* URL + platform badge */}
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <label className={labelClass + ' mb-0'}>URL</label>
                                    {item.platform && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformBadge[item.platform]}`}>
                                            {platformLabel[item.platform]}
                                        </span>
                                    )}
                                    {item.url && !item.platform && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-yellow-500/20 text-yellow-300 border-yellow-500/20">
                                            Unrecognized
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="url"
                                    value={item.url}
                                    onChange={e => handleItemChange(index, 'url', e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                                    placeholder="https://www.tiktok.com/@user/video/..."
                                />
                            </div>

                            {/* Caption */}
                            <div>
                                <label className={labelClass}>Caption (optional)</label>
                                <input
                                    type="text"
                                    value={item.caption || ''}
                                    onChange={e => handleItemChange(index, 'caption', e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                                    placeholder="Optional caption"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => handleDeleteItem(index)}
                                className="absolute top-2 right-2 p-1.5 bg-gray-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-red-400 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                                title="Remove embed"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {items.length > 0 && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium leading-relaxed">
                    Supported: TikTok, Instagram posts/reels, and YouTube Shorts URLs.
                </p>
            )}
        </div>
    );
}

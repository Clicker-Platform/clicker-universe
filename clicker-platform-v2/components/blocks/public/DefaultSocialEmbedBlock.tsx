'use client';

import { Play } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

type Platform = 'tiktok' | 'instagram' | 'youtube';

interface SocialEmbedItem {
    url: string;
    platform: Platform | null;
    caption?: string;
}

interface SocialEmbedData {
    title?: string;
    limit?: number;
    items?: SocialEmbedItem[];
}

interface DefaultSocialEmbedBlockProps {
    data: SocialEmbedData;
    previewMode?: boolean;
}

const platformLabel: Record<Platform, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    youtube: 'YouTube',
};

const platformColor: Record<Platform, string> = {
    tiktok: 'bg-pink-500/20 text-pink-300',
    instagram: 'bg-purple-500/20 text-purple-300',
    youtube: 'bg-red-500/20 text-red-300',
};

function resolvePlatform(item: SocialEmbedItem): Platform | null {
    if (item.platform) return item.platform;
    const url = item.url || '';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return null;
}

function getEmbedUrl(item: SocialEmbedItem): string | null {
    const { url } = item;
    const platform = resolvePlatform(item);
    if (!url || !platform) return null;

    if (platform === 'tiktok') {
        const match = url.match(/\/video\/(\d+)/);
        return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : null;
    }

    if (platform === 'instagram') {
        const match = url.match(/\/(p|reel|tv)\/([^/?]+)/);
        return match ? `https://www.instagram.com/p/${match[2]}/embed/` : null;
    }

    if (platform === 'youtube') {
        const shortsMatch = url.match(/\/shorts\/([^/?]+)/);
        if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
        const vMatch = url.match(/[?&]v=([^&]+)/);
        if (vMatch) return `https://www.youtube.com/embed/${vMatch[1]}`;
        const shortMatch = url.match(/youtu\.be\/([^/?]+)/);
        if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
        return null;
    }

    return null;
}

function getAspectRatio(item: SocialEmbedItem): string {
    const platform = resolvePlatform(item);
    if (!platform) return '1 / 1';
    
    if (platform === 'youtube') {
        const url = item.url || '';
        if (url.includes('/shorts/')) return '9 / 16';
        return '16 / 9'; // regular YouTube videos
    }
    
    if (platform === 'instagram') {
        return '4 / 5'; // standard Instagram portrait
    }
    
    return '9 / 16'; // TikTok defaults to 9:16
}

export function DefaultSocialEmbedBlock({ data, previewMode }: DefaultSocialEmbedBlockProps) {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    const allItems = data.items || [];
    const limit = Math.max(1, Math.min(12, data.limit ?? 6));
    const validItems = allItems
        .filter(item => item.url && resolvePlatform(item))
        .slice(0, limit);

    if (validItems.length === 0) return null;

    const baseCardClass = isClean
        ? 'rounded-xl overflow-hidden'
        : isGlass
        ? 'rounded-2xl overflow-hidden'
        : 'rounded-2xl shadow-sticker overflow-hidden';

    const cardClass = `${baseCardClass} w-[80%] max-w-[280px] sm:w-[320px] shrink-0`;

    return (
        <div className="w-full min-w-0 space-y-4">
            {data.title && (
                <h2 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-4 px-1">
                    {data.title}
                </h2>
            )}

            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 pt-2 -webkit-overflow-scrolling-touch [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                {validItems.map((item, idx) => (
                    <div key={idx} className={`${cardClass} snap-start`}>
                        <EmbedTile item={item} previewMode={previewMode} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function EmbedTile({ item, previewMode }: { item: SocialEmbedItem; previewMode?: boolean }) {
    const embedUrl = getEmbedUrl(item);
    const platform = resolvePlatform(item);

    return (
        <div>
            {/* Dynamic aspect ratio container based on content */}
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: getAspectRatio(item) }}>
                {!embedUrl ? (
                    // Placeholder shown when there is no valid embed URL
                    <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 flex flex-col items-center justify-center gap-2 text-neutral-400">
                        <Play size={32} className="opacity-40" />
                        {platform && (
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${platformColor[platform]}`}>
                                {platformLabel[platform]}
                            </span>
                        )}
                        {item.url && (
                            <p className="text-[10px] text-center px-3 opacity-60 line-clamp-2">{item.url}</p>
                        )}
                    </div>
                ) : (
                    <>
                        <iframe
                            src={embedUrl}
                            className="absolute inset-0 w-full h-full scale-[1.02] origin-center bg-black"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope; web-share"
                            allowFullScreen
                            loading="lazy"
                            title={item.caption || `${item.platform} embed`}
                            style={{ border: 0 }}
                        />
                        {/* Transparent overlay in preview mode to prevent iframe from trapping clicks */}
                        {previewMode && (
                            <div className="absolute inset-0 z-10 bg-transparent" />
                        )}
                    </>
                )}
            </div>

            {item.caption && (
                <p className="text-xs text-center py-2 px-3 text-gray-500 dark:text-neutral-400 truncate">
                    {item.caption}
                </p>
            )}
        </div>
    );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Image as ImageIcon } from 'lucide-react';
import { FullScreenGallery } from '@/components/common/FullScreenGallery';
import { useTemplate } from '@/components/TemplateProvider';

// 1x1 gray SVG — shown by Next.js while the real image downloads
const BLUR_PLACEHOLDER =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';

interface ImageGalleryBlockProps {
    data: {
        images?: string[];
        coverImage?: string;
    };
    isFirst?: boolean;
}

// Tile used in both mobile cover and desktop grid
function GalleryTile({
    src,
    alt,
    onClick,
    priority = false,
    badge,
    cardClass,
}: {
    src: string;
    alt: string;
    onClick: () => void;
    priority?: boolean;
    badge?: React.ReactNode;
    cardClass: string;
}) {
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Ensure state updates if image is already cached by the browser
    // when navigating via browser back button
    useEffect(() => {
        if (imgRef.current?.complete) {
            setLoaded(true);
        }
    }, [src]);

    return (
        <div
            onClick={onClick}
            className={`relative overflow-hidden cursor-pointer group aspect-square ${cardClass}`}
            style={{ borderRadius: 'var(--theme-radius)' }}
        >
            {/* Shimmer while loading */}
            {!loaded && (
                <div
                    className="absolute inset-0 z-10 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                    style={{ animation: 'shimmer 1.4s infinite linear', backgroundSize: '200% 100%' }}
                />
            )}
            <Image
                ref={imgRef}
                src={src}
                alt={alt}
                fill
                priority={priority}
                placeholder="blur"
                blurDataURL={BLUR_PLACEHOLDER}
                onLoad={() => setLoaded(true)}
                className={`object-cover object-center transition-all duration-500 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                sizes="(max-width: 768px) 100vw, 50vw"
            />
            {badge}
        </div>
    );
}

export const DefaultImageGalleryBlock = ({ data, isFirst = false }: ImageGalleryBlockProps) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';
    const [isOpen, setIsOpen] = useState(false);
    const [initialIndex, setInitialIndex] = useState(0);

    const images = (data.images || []).filter(url => url && url.trim() !== '');

    const validCover = data.coverImage?.trim() || null;
    const coverThumb = validCover || (images.length > 0 ? images[0] : null);

    if (!images.length) return null;

    const openAt = (index: number) => {
        setInitialIndex(index);
        setIsOpen(true);
    };

    // Card border style shared across tiles
    const cardClass = isClean
        ? 'border border-gray-200 hover:shadow-md'
        : isGlass
        ? 'border border-white/10 hover:border-white/20'
        : 'border-[3px] border-theme-border shadow-sticker hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]';

    // Photo badge sits on top of user-uploaded photos at arbitrary luminance.
    // White-on-overlay is the universal contrast solution — spec §3.1 allows
    // contrast colors over user surfaces. Overlay color routed through token.
    const photoBadge = (
        <div
            className="absolute bottom-3 right-3 backdrop-blur-md text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20 shadow-sm border border-white/10"
            style={{ backgroundColor: 'var(--theme-overlay)', color: 'rgba(255,255,255,0.95)' }}
        >
            <ImageIcon size={14} />
            <span>{images.length} Photos</span>
        </div>
    );

    return (
        <>
            {/* ── Mobile: single cover tile ── */}
            <div className="md:hidden w-full" style={{ borderRadius: 'var(--theme-radius)' }}>
                {coverThumb ? (() => {
                    const coverIndex = validCover ? Math.max(0, images.indexOf(validCover)) : 0;
                    return (
                        <GalleryTile
                            src={coverThumb}
                            alt="Gallery Cover"
                            onClick={() => openAt(coverIndex)}
                            priority={isFirst}
                            badge={photoBadge}
                            cardClass={`w-full ${cardClass}`}
                        />
                    );
                })() : null}
            </div>

            {/* ── Desktop: 2-column grid ── */}
            <div
                className="hidden md:grid grid-cols-2 gap-2"
                style={{ borderRadius: 'var(--theme-radius)' }}
            >
                {images.map((url, idx) => (
                    <GalleryTile
                        key={idx}
                        src={url}
                        alt={`Gallery image ${idx + 1}`}
                        onClick={() => openAt(idx)}
                        priority={isFirst && idx < 2}
                        badge={idx === images.length - 1 && images.length > 1 ? photoBadge : undefined}
                        cardClass={cardClass}
                    />
                ))}
            </div>

            <FullScreenGallery
                isOpen={isOpen}
                images={images}
                initialIndex={initialIndex}
                onClose={() => setIsOpen(false)}
            />
        </>
    );
};

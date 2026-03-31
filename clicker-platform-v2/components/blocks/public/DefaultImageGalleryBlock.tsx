'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Image as ImageIcon } from 'lucide-react';
import { FullScreenGallery } from '@/components/common/FullScreenGallery';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv } from '@/components/DeviceViewContext';

// Lightweight inline SVG base64 used as blur placeholder (1x1 gray pixel)
const BLUR_PLACEHOLDER =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';

interface ImageGalleryBlockProps {
    data: {
        images?: string[];
        coverImage?: string;
    };
}

export const DefaultImageGalleryBlock = ({ data }: ImageGalleryBlockProps) => {
    const { theme } = useTemplate();
    const d = useDeviceView();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';
    const [isOpen, setIsOpen] = useState(false);
    const [initialIndex, setInitialIndex] = useState(0);

    const images = (data.images || []).filter(url => url && url.trim() !== '');
    const validCover = (data.coverImage && data.coverImage.trim() !== '') ? data.coverImage : null;
    const coverImage = validCover || (images.length > 0 ? images[0] : null);

    if (!images.length && !coverImage) return null;

    const openGallery = () => {
        const startIdx = coverImage ? images.indexOf(coverImage) : 0;
        setInitialIndex(startIdx !== -1 ? startIdx : 0);
        setIsOpen(true);
    };

    return (
        <>
            {/* Trigger (Cover Image) */}
            <div
                onClick={openGallery}
                className={`
                    w-full relative overflow-hidden cursor-pointer group transition-all
                    ${isClean
                        ? 'rounded-xl border border-gray-200 hover:shadow-md'
                        : isGlass
                        ? 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md hover:border-white/20 hover:bg-white/10'
                        : 'rounded-2xl border-[3px] border-theme-border shadow-sticker hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]'
                    }
                    ${dv(d, 'aspect-[4/5]', 'md:aspect-[21/9]')}
                `}
                style={{ borderRadius: 'var(--theme-radius)' }}
            >
                {coverImage ? (
                    <>
                        {/*
                         * Background blur layer — same URL as cover.
                         * Use fill + object-cover so it always fills the container.
                         * sizes="100vw" matches the actual rendered width (w-full).
                         * No priority — it's decorative and loads after the main image.
                         */}
                        <div className="absolute inset-0 z-0 overflow-hidden">
                            <Image
                                src={coverImage}
                                alt=""
                                aria-hidden="true"
                                fill
                                sizes="100vw"
                                quality={10}
                                className="object-cover blur-xl scale-110 opacity-50"
                                placeholder="blur"
                                blurDataURL={BLUR_PLACEHOLDER}
                            />
                            <div className="absolute inset-0 bg-white/20 backdrop-blur-sm" />
                        </div>

                        {/*
                         * Main cover image — this is the LCP element.
                         * priority=true injects a <link rel="preload"> and disables lazy loading.
                         * sizes matches real layout: full-width on mobile, up to 1200px on desktop.
                         */}
                        <div className="absolute inset-0 z-10 flex items-center justify-center p-2">
                            <div className="relative w-full h-full shadow-lg rounded-lg overflow-hidden">
                                <Image
                                    src={coverImage}
                                    alt="Gallery Cover"
                                    fill
                                    priority
                                    placeholder="blur"
                                    blurDataURL={BLUR_PLACEHOLDER}
                                    className={`${dv(d, 'object-cover', 'md:object-contain')} object-center transition-transform duration-500 group-hover:scale-105`}
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                        <ImageIcon size={48} />
                    </div>
                )}

                {/* Overlay Badge */}
                <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20 shadow-sm border border-white/10">
                    <ImageIcon size={14} />
                    <span>{images.length} Photos</span>
                </div>
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

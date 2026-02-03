'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Image as ImageIcon } from 'lucide-react';
import { FullScreenGallery } from '@/components/common/FullScreenGallery';

interface ImageGalleryBlockProps {
    data: {
        images?: string[];
        coverImage?: string;
    };
}

import { useTemplate } from '@/components/TemplateProvider';

export const ImageGalleryBlock = ({ data }: ImageGalleryBlockProps) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const [isOpen, setIsOpen] = useState(false);
    const [initialIndex, setInitialIndex] = useState(0);

    const images = (data.images || []).filter(url => url && url.trim() !== '');
    const validCover = (data.coverImage && data.coverImage.trim() !== '') ? data.coverImage : null;
    const coverImage = validCover || (images.length > 0 ? images[0] : null);

    // Don't render if no images
    if (!cardsExist(images) && !coverImage) return null;

    function cardsExist(images: string[]) {
        return images && images.length > 0;
    }

    const openGallery = () => {
        // Ensure starting index matches cover or 0
        const startIdx = images.indexOf(coverImage as string);
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
                        : 'rounded-2xl border-[3px] border-theme-border shadow-sticker hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]'
                    }
                    /* Adaptive Aspect Ratio */
                    aspect-[4/5] md:aspect-[21/9]
                `}
                style={{ borderRadius: 'var(--theme-radius)' }}
            >
                {coverImage ? (
                    <>
                        {/* Background Layer (Blurred) - Visible on Desktop if image is portrait-ish, or just fills */}
                        <div className="absolute inset-0 z-0">
                            <Image
                                src={coverImage}
                                alt="Background"
                                fill
                                className="object-cover blur-xl scale-110 opacity-50"
                            />
                            <div className="absolute inset-0 bg-white/20 backdrop-blur-sm" />
                        </div>

                        {/* Main Image - Contain Mode to prevent cropping, centered */}
                        <div className="absolute inset-0 z-10 flex items-center justify-center p-2">
                            <div className="relative w-full h-full shadow-lg rounded-lg overflow-hidden">
                                <Image
                                    src={coverImage}
                                    alt="Gallery Cover"
                                    fill
                                    className="object-cover md:object-contain object-center transition-transform duration-500 group-hover:scale-105"
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

            {/* Reusable Full Screen Gallery */}
            <FullScreenGallery
                isOpen={isOpen}
                images={images}
                initialIndex={initialIndex}
                onClose={() => setIsOpen(false)}
            />
        </>
    );
};

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

// 1x1 gray SVG — instant visual while real image loads
const BLUR_PLACEHOLDER =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4=';

interface FullScreenGalleryProps {
    isOpen: boolean;
    images: string[];
    initialIndex?: number;
    onClose: () => void;
}

const IMAGE_QUALITY = 85;

export const FullScreenGallery = ({ isOpen, images, initialIndex = 0, onClose }: FullScreenGalleryProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [mounted, setMounted] = useState(false);
    const [mainLoaded, setMainLoaded] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Preload every fullscreen image as soon as the block mounts so tapping the
    // gallery opens instantly instead of kicking off a Firebase fetch. Each image
    // is rendered full-size but kept off-screen — sizes="100vw" + matching quality
    // means the URL is identical to what the visible <Image> will request, so the
    // browser serves it straight from HTTP cache.
    const preloadPortal = mounted
        ? createPortal(
              <div
                  aria-hidden="true"
                  className="fixed top-0 left-0 w-screen h-screen opacity-0 pointer-events-none -z-10 overflow-hidden"
                  style={{ contain: 'strict' }}
              >
                  {images.map((src, idx) => (
                      <Image
                          key={`preload-${idx}-${src}`}
                          src={src}
                          alt=""
                          fill
                          sizes="100vw"
                          quality={IMAGE_QUALITY}
                          priority
                      />
                  ))}
              </div>,
              document.body
          )
        : null;

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            setMainLoaded(false);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, initialIndex]);

    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setMainLoaded(false);
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setMainLoaded(false);
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!mounted) return null;
    if (!isOpen) return preloadPortal;

    return (<>{preloadPortal}{createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center touch-none">
            {/* Header / Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
                <div className="text-white/80 font-mono text-sm">
                    {currentIndex + 1} / {images.length}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Main Image Container */}
            <div className="w-full h-full flex items-center justify-center p-4 md:p-10 relative">
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Shimmer shown while main image loads */}
                    {!mainLoaded && (
                        <div className="absolute inset-0 z-10 bg-gradient-to-r from-white/5 via-white/10 to-white/5"
                            style={{ animation: 'shimmer 1.4s infinite linear', backgroundSize: '200% 100%' }}
                        />
                    )}
                    <Image
                        src={images[currentIndex]}
                        alt={`Gallery image ${currentIndex + 1}`}
                        className={`object-contain select-none transition-opacity duration-300 ${mainLoaded ? 'opacity-100' : 'opacity-0'}`}
                        fill
                        sizes="100vw"
                        quality={IMAGE_QUALITY}
                        placeholder="blur"
                        blurDataURL={BLUR_PLACEHOLDER}
                        draggable={false}
                        priority
                        onLoad={() => setMainLoaded(true)}
                    />
                </div>

                {/* Navigation Arrows */}
                <button
                    onClick={prevImage}
                    className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all md:opacity-0 hover:opacity-100 md:group-hover:opacity-100"
                    aria-label="Previous image"
                >
                    <ChevronLeft size={24} />
                </button>

                <button
                    onClick={nextImage}
                    className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all md:opacity-0 hover:opacity-100 md:group-hover:opacity-100"
                    aria-label="Next image"
                >
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* Scrollable Thumbnail Strip */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x px-4 md:justify-center justify-start">
                    {images.map((img, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setMainLoaded(false); }}
                            className={`relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden transition-all snap-center bg-white/10 ${idx === currentIndex
                                ? 'ring-2 ring-white opacity-100 scale-105'
                                : 'opacity-50 hover:opacity-80'
                            }`}
                        >
                            <Image
                                src={img}
                                alt={`Thumbnail ${idx + 1}`}
                                fill
                                sizes="80px"
                                quality={40}
                                className="object-cover"
                                placeholder="blur"
                                blurDataURL={BLUR_PLACEHOLDER}
                            />
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    )}</>);
};

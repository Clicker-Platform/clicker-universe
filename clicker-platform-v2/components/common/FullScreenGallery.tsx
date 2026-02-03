'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface FullScreenGalleryProps {
    isOpen: boolean;
    images: string[];
    initialIndex?: number;
    onClose: () => void;
}

import { createPortal } from 'react-dom';

// ... (keep props interface)

export const FullScreenGallery = ({ isOpen, images, initialIndex = 0, onClose }: FullScreenGalleryProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Sync state if initialIndex changes when opening
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, initialIndex]);

    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // ... (keep navigation logic: nextImage, prevImage, keyboard handlers)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]); // Added onClose to deps

    if (!mounted || !isOpen) return null;

    return createPortal(
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
                {/* Image */}
                <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                        key={currentIndex}
                        src={images[currentIndex]}
                        alt={`Gallery image ${currentIndex + 1}`}
                        className="object-contain select-none animate-in fade-in zoom-in-95 duration-200"
                        fill
                        sizes="100vw"
                        draggable={false}
                        priority
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
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                            className={`relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden transition-all snap-center ${idx === currentIndex
                                ? 'ring-2 ring-white opacity-100 scale-105'
                                : 'opacity-50 hover:opacity-80'
                                }`}
                        >
                            <img
                                src={img}
                                alt={`Thumbnail ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';
import { X, ChevronLeft, ChevronRight, Maximize } from 'lucide-react';
import { Product } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { WhatsappButton } from '@/components/common/WhatsappButton';
import { FullScreenGallery } from '@/components/common/FullScreenGallery';

interface ProductDetailModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    phoneNumber?: string;
    whatsappSettings?: {
        label?: string;
        messageTemplate?: string;
        bgColor?: string;
        textColor?: string;
        ctaMode?: 'whatsapp' | 'url' | 'both';
        ctaUrl?: string;
        ctaUrlLabel?: string;
    };
}

import { createPortal } from 'react-dom';

export function ProductDetailModal({ product, isOpen, onClose, phoneNumber = '15551234567', whatsappSettings }: ProductDetailModalProps) {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        Promise.resolve().then(() => setMounted(true));
        return () => setMounted(false);
    }, []);

    // Reset index when product changes
    React.useEffect(() => {
        if (isOpen) {
            setCurrentImageIndex(0);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, product]);

    if (!mounted || !isOpen || !product) return null;

    // Get images array (support legacy imageUrl)
    const images = product.images && product.images.length > 0
        ? product.images
        : [product.imageUrl];

    const showGallery = images.length > 1;

    // Visibility Checks
    const showPrice = product.showPrice !== false;
    const showLabel = product.showLabel !== false;

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Dynamic Styles based on Theme
    const modalStyle: React.CSSProperties = {
        backgroundColor: theme.colors.surface || theme.colors.background,
        fontFamily: theme.fonts.body,
        color: theme.colors.foreground,
        maxHeight: '95vh',
    };

    const priceTagStyle = {
        backgroundColor: theme.colors.primary,
        color: theme.colors.accent === theme.colors.primary ? '#FFFFFF' : theme.colors.accent,
        borderColor: theme.colors.accent
    };

    const titleStyle = {
        color: theme.colors.foreground,
        fontFamily: theme.fonts.heading
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-0 md:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Card */}
            <div
                className={`
                        relative w-full max-w-lg overflow-hidden shadow-2xl flex flex-col
                        animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in-95
                        rounded-t-[2rem] md:rounded-[2rem]
                    `}
                style={{
                    ...modalStyle,
                    borderRadius: undefined
                }}
            >
                <style jsx>{`
                        @media (min-width: 768px) {
                            div[style*="background-color"] {
                                border-radius: ${theme.borderRadius || '24px'} !important;
                            }
                        }
                    `}</style>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors backdrop-blur-md"
                >
                    <X size={20} />
                </button>

                {/* Fullscreen Button */}
                {showGallery && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsFullScreenOpen(true); }}
                        className="absolute top-4 right-14 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors backdrop-blur-md flex items-center gap-1 group/fs"
                        title="View Fullscreen"
                    >
                        <Maximize size={20} />
                        <span className="max-w-0 overflow-hidden group-hover/fs:max-w-xs transition-all duration-300 ease-out text-sm font-medium whitespace-nowrap pl-0 group-hover/fs:pl-1">
                            Fullscreen
                        </span>
                    </button>
                )}

                <FullScreenGallery
                    isOpen={isFullScreenOpen}
                    images={images}
                    initialIndex={currentImageIndex}
                    onClose={() => setIsFullScreenOpen(false)}
                />

                {/* Gallery / Hero Image */}
                <div className="w-full aspect-square bg-gray-100 relative group shrink-0">
                    <Image
                        src={images[currentImageIndex]}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 480px"
                        placeholder="blur"
                        blurDataURL={BLUR_PLACEHOLDER}
                        className="object-cover transition-opacity duration-300"
                        quality={85}
                    />

                    {/* Navigation Arrows */}
                    {showGallery && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button
                                onClick={nextImage}
                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronRight size={24} />
                            </button>

                            {/* Dots Indicator */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 p-1.5 rounded-full backdrop-blur-sm">
                                {images.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`
                                                w-2 h-2 rounded-full transition-all 
                                                ${idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'}
                                            `}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Thumbnails (if gallery) */}
                {showGallery && (
                    <div className="flex gap-2 p-4 pb-2 overflow-x-auto no-scrollbar shrink-0">
                        {images.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentImageIndex(idx)}
                                className={`
                                        relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all
                                        ${idx === currentImageIndex ? 'border-brand-dark opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}
                                    `}
                            >
                                <Image src={img} alt="" fill sizes="64px" placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} className="object-cover" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            {showLabel && product.category && (
                                <span className="inline-block bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                                    {product.category}
                                </span>
                            )}
                            <h2
                                className="text-2xl font-black leading-tight"
                                style={titleStyle}
                            >
                                {product.name}
                            </h2>
                        </div>
                        {showPrice && (
                            <div
                                className={`px-3 py-1 rounded-xl font-black text-lg whitespace-nowrap ${
                                    isClean ? 'shadow-sm border' : isGlass ? 'shadow-sm border border-white/20 backdrop-blur-md' : 'border-2 shadow-sm -rotate-2'
                                }`}
                                style={priceTagStyle}
                            >
                                {product.price}
                            </div>
                        )}
                    </div>

                    <div className="mb-8">
                        <p className="font-medium leading-relaxed opacity-80 whitespace-pre-line text-base">
                            {product.description || "No description available."}
                        </p>
                    </div>

                    {/* CTA */}
                    {(() => {
                        const effectiveMode = product.ctaMode || whatsappSettings?.ctaMode || 'whatsapp';
                        const effectiveUrl = product.ctaUrl || '';
                        const waMessage = whatsappSettings?.messageTemplate
                            ? whatsappSettings.messageTemplate
                                .replace('${productName}', product.name)
                                .replace('${productPrice}', product.price)
                            : `Hi! I'd like to order the ${product.name} for ${product.price}.`;

                        const urlBtn = effectiveUrl ? (
                            <a
                                href={effectiveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-4 font-bold text-lg hover:opacity-90 transition-opacity hover:-translate-y-0.5 transform duration-200"
                                style={{
                                    backgroundColor: 'var(--theme-primary)',
                                    color: theme.colors.accentForeground || '#ffffff',
                                    borderRadius: 'var(--theme-radius)',
                                    boxShadow: 'var(--theme-card-shadow)',
                                }}
                            >
                                {whatsappSettings?.ctaUrlLabel || 'View Product'}
                            </a>
                        ) : null;

                        const waBtn = (
                            <WhatsappButton
                                phoneNumber={phoneNumber || '15551234567'}
                                message={waMessage}
                                label={whatsappSettings?.label || 'Order on WhatsApp'}
                                style={{
                                    backgroundColor: whatsappSettings?.bgColor || '#25D366',
                                    color: whatsappSettings?.textColor || '#FFFFFF',
                                }}
                            />
                        );

                        if ((effectiveMode as string) === 'none') return null;
                        if (effectiveMode === 'url') return urlBtn;
                        if (effectiveMode === 'both') return <div className="flex flex-col gap-2">{urlBtn}{waBtn}</div>;
                        return waBtn;
                    })()}
                </div>
            </div>
        </div>,
        document.body
    );
};

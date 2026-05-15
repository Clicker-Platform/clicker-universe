'use client';

import React, { useState } from 'react';
import { Product } from '@/data/mockData';
import { Star, ArrowRight, Image as ImageIcon, Maximize } from 'lucide-react';
import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';
import { ProductDetailModal } from '@/components/catalog/ProductDetailModal';
import { FullScreenGallery } from '@/components/common/FullScreenGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { getCardClasses, getGlassStyle } from './cardStyles';

interface WhatsAppSettings {
    label?: string;
    messageTemplate?: string;
    bgColor?: string;
    textColor?: string;
    ctaMode?: 'whatsapp' | 'url' | 'both';
    ctaUrl?: string;
    ctaUrlLabel?: string;
}

interface DefaultFeaturedProductBlockProps {
    product: Product;
    previewMode?: boolean;
    badgeText?: string;
    showBadge?: boolean;
    buttonText?: string;
    phoneNumber?: string;
    whatsappSettings?: WhatsAppSettings;
}

export function DefaultFeaturedProductBlock({
    product,
    previewMode,
    badgeText = 'Featured',
    showBadge = true,
    buttonText = 'Ask Product',
    phoneNumber,
    whatsappSettings,
}: DefaultFeaturedProductBlockProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

    const { theme } = useTemplate();

    const isClean = theme?.cardStyle === 'clean';
    const isGlass = theme?.cardStyle === 'glass';
    const isBold = !isClean && !isGlass;

    const handleOrderClick = () => {
        if (previewMode) return;
        setIsModalOpen(true);
    };

    const validImages = (product.images || []).filter(url => url && url.trim() !== '');
    const mainImage =
        product.imageUrl && product.imageUrl.trim() !== ''
            ? product.imageUrl
            : validImages.length > 0
            ? validImages[0]
            : null;
    const images = validImages.length > 0 ? validImages : mainImage ? [mainImage] : [];
    const showGallery = images.length > 1;

    const colors = theme?.colors ?? {};
    const fonts = theme?.fonts ?? {};
    const primaryContrastColor =
        colors.accent && colors.accent !== colors.primary
            ? colors.accent
            : colors.background ?? undefined;

    const badgeStyle = isBold
        ? {
              backgroundColor: colors.primary,
              borderColor: colors.foreground,
              color: colors.foreground,
          }
        : {
              backgroundColor: colors.primary,
              color: primaryContrastColor,
          };

    const imageContainerStyle = {
        borderRadius: `calc(var(--theme-radius) * 0.75)`,
        backgroundColor: isGlass
            ? `${colors.surface || colors.background}10`
            : colors.muted || colors.border || '#f3f4f6',
        borderColor: isBold ? colors.foreground : colors.border || colors.foreground,
    };

    return (
        <div className="relative">
            {/* Badge */}
            {showBadge && (
                <div className={isGlass ? 'mb-4' : 'absolute -top-5 left-1/2 -translate-x-1/2 z-20 w-max'}>
                    {isGlass ? (
                        <span
                            className="text-xs font-bold uppercase tracking-[0.2em]"
                            style={{
                                color: colors.muted || colors.foreground,
                                opacity: colors.muted ? 1 : 0.5,
                            }}
                        >
                            {badgeText}
                        </span>
                    ) : !isBold ? (
                        <div
                            className="px-4 py-1 rounded-full shadow-sm flex items-center gap-2"
                            style={{ ...badgeStyle, fontFamily: fonts.body }}
                        >
                            <Star size={14} className="fill-current" />
                            <span className="font-bold uppercase tracking-wider text-xs">{badgeText}</span>
                        </div>
                    ) : (
                        <div
                            className="border-[3px] px-6 py-2 rounded-full rotate-[-2deg] flex items-center gap-2 animate-bounce"
                            style={{
                                ...badgeStyle,
                                boxShadow: `2px 2px 0px 0px ${colors.foreground}`,
                                fontFamily: fonts.body,
                            }}
                        >
                            <Star size={20} className="fill-current" />
                            <span className="font-black uppercase tracking-wider text-sm">{badgeText}</span>
                            <Star size={20} className="fill-current" />
                        </div>
                    )}
                </div>
            )}

            {/* Card */}
            <div
                className={[
                    'group relative transition-all duration-300 p-4',
                    !isBold ? 'hover:shadow-md' : 'hover:-translate-y-1',
                    isGlass ? 'backdrop-blur-md' : '',
                    isBold ? 'border-[3px]' : 'border',
                    getCardClasses(theme.cardStyle),
                ].join(' ')}
                style={
                    isGlass
                        ? {
                              ...getGlassStyle(colors.surface),
                              borderRadius: 'var(--theme-radius)',
                              borderColor: colors.border || colors.foreground,
                          }
                        : {
                              borderRadius: 'var(--theme-radius)',
                              backgroundColor: colors.surface || colors.background,
                              borderColor: isBold
                                  ? colors.foreground
                                  : colors.border || colors.foreground,
                              boxShadow: isBold
                                  ? `4px 4px 0px 0px ${colors.border}`
                                  : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                          }
                }
            >
                {/* Image */}
                <div
                    className={[
                        'w-full aspect-[4/3] overflow-hidden mb-5 relative',
                        isBold ? 'border-[3px]' : '',
                    ].join(' ')}
                    style={imageContainerStyle}
                >
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                            <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
                            <ImageIcon
                                className="w-16 h-16 relative z-20"
                                strokeWidth={2}
                                style={{ color: colors.border || colors.foreground, opacity: 0.4 }}
                            />
                        </div>
                    )}

                    {showGallery && (
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                if (!previewMode) setIsFullScreenOpen(true);
                            }}
                            className="absolute top-4 right-4 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors backdrop-blur-md flex items-center gap-1 group/fs"
                            title="View Fullscreen"
                        >
                            <Maximize size={20} />
                            <span className="max-w-0 overflow-hidden group-hover/fs:max-w-xs transition-all duration-300 ease-out text-sm font-medium whitespace-nowrap pl-0 group-hover/fs:pl-1">
                                Fullscreen
                            </span>
                        </button>
                    )}

                    {mainImage ? (
                        <Image
                            src={mainImage}
                            alt={product.name}
                            fill
                            priority
                            sizes="(max-width: 768px) 100vw, 500px"
                            onLoad={() => setIsLoading(false)}
                            onError={() => setIsLoading(false)}
                            className={`object-cover transition-all duration-700 group-hover:scale-105 ${
                                isLoading ? 'opacity-0' : 'opacity-100'
                            }`}
                        />
                    ) : (
                        <div
                            className="flex items-center justify-center w-full h-full"
                            style={{ color: colors.border || colors.foreground, opacity: 0.4 }}
                        >
                            <ImageIcon className="w-16 h-16" />
                        </div>
                    )}

                    {/* Price Tag */}
                    {product.showPrice !== false && (
                        <div
                            className={[
                                'absolute bottom-4 right-4 z-20',
                                isBold
                                    ? 'px-4 py-2 rounded-xl border-2 font-black text-xl rotate-[-3deg] group-hover:rotate-0 transition-transform'
                                    : '',
                            ].join(' ')}
                            style={
                                isBold
                                    ? {
                                          backgroundColor: colors.foreground,
                                          color: colors.primary,
                                          borderColor: colors.primary,
                                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                          fontFamily: fonts.heading,
                                      }
                                    : { fontFamily: fonts.body }
                            }
                        >
                            {!isBold ? (
                                <div
                                    className="px-3 py-1.5 rounded-lg font-bold text-lg border shadow-sm backdrop-blur-md"
                                    style={{
                                        backgroundColor: `${colors.surface || colors.background}E6`,
                                        color: colors.foreground,
                                        borderColor: colors.border || colors.foreground,
                                    }}
                                >
                                    {product.price}
                                </div>
                            ) : (
                                product.price
                            )}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="text-center px-2 pb-2">
                    <h3
                        className={`mb-3 uppercase leading-none tracking-tight ${
                            !isBold ? 'font-bold text-2xl' : 'font-black text-3xl'
                        }`}
                        style={{ color: colors.foreground, fontFamily: fonts.heading }}
                    >
                        {product.name}
                    </h3>

                    <button
                        onClick={handleOrderClick}
                        className="w-full py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
                        style={{
                            borderRadius: 'calc(var(--theme-radius) * 0.6)',
                            backgroundColor: isBold ? colors.foreground : colors.primary,
                            color: isBold ? colors.background : primaryContrastColor,
                            border: isBold
                                ? `3px solid ${colors.foreground}`
                                : `1px solid ${colors.border || colors.primary}`,
                            boxShadow: isBold
                                ? `4px 4px 0px 0px ${colors.border}`
                                : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontWeight: isBold ? 800 : 700,
                            textTransform: isBold ? 'uppercase' : 'none',
                            letterSpacing: isBold ? '0.05em' : 'normal',
                            fontFamily: fonts.heading,
                        }}
                    >
                        {buttonText} <ArrowRight size={24} strokeWidth={isBold ? 3 : 2} />
                    </button>
                </div>
            </div>

            {!previewMode && (
                <>
                    <ProductDetailModal
                        product={product}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        phoneNumber={phoneNumber}
                        whatsappSettings={whatsappSettings}
                    />
                    <FullScreenGallery
                        isOpen={isFullScreenOpen}
                        images={images}
                        initialIndex={0}
                        onClose={() => setIsFullScreenOpen(false)}
                    />
                </>
            )}
        </div>
    );
}

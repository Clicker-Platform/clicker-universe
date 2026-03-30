'use client';

import React, { useState } from 'react';
import { Product } from '@/data/mockData';
import { Sparkles, ArrowRight, Image as ImageIcon, Maximize } from 'lucide-react';
import Image from 'next/image';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { ProductDetailModal } from './catalog/ProductDetailModal';
import { FullScreenGallery } from '@/components/common/FullScreenGallery';
import { Skeleton } from "@/components/ui/skeleton";

interface FeaturedProductProps {
    product: Product;
    badgeText?: string;
    showBadge?: boolean;
    buttonText?: string;
    phoneNumber?: string;
    whatsappSettings?: any;
}

export const FeaturedProduct: React.FC<FeaturedProductProps> = ({
    product,
    badgeText = "Featured",
    showBadge = true,
    buttonText = "Ask Product",
    phoneNumber,
    whatsappSettings
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
    const { track } = useAnalytics();
    const { templateId, theme } = useTemplate();
    const { siteId } = useSite();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';
    const isBold = !isClean && !isGlass;

    const handleOrderClick = () => {
        track({ type: 'product_click', id: product.id, siteId });
        setIsModalOpen(true);
    };

    // Get images array (support legacy imageUrl)
    // Get images array (support legacy imageUrl) safely
    const validImages = (product.images || []).filter(url => url && url.trim() !== '');
    const mainImage = product.imageUrl && product.imageUrl.trim() !== '' ? product.imageUrl : (validImages.length > 0 ? validImages[0] : null);

    const images = validImages.length > 0
        ? validImages
        : (mainImage ? [mainImage] : []);

    const showGallery = images.length > 1;

    // Derive a contrast text color for primary backgrounds
    const primaryContrastColor = theme.colors.accent && theme.colors.accent !== theme.colors.primary
        ? theme.colors.accent
        : theme.colors.background;

    // Dynamic styles based on theme
    const badgeStyle = isBold ? {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.foreground,
        color: theme.colors.foreground
    } : {
        backgroundColor: theme.colors.primary,
        color: primaryContrastColor
    };

    const containerStyle = {
        borderRadius: `var(--theme-radius)`,
        backgroundColor: isGlass ? `${theme.colors.surface || theme.colors.background}33` : (theme.colors.surface || theme.colors.background),
        borderColor: isBold ? theme.colors.foreground : (theme.colors.border || theme.colors.foreground),
        boxShadow: isBold ? `4px 4px 0px 0px ${theme.colors.border}` : isGlass ? '0 8px 32px 0 rgba(0, 0, 0, 0.3)' : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
    };

    const imageContainerStyle = {
        borderRadius: `calc(var(--theme-radius) * 0.75)`,
        backgroundColor: isGlass ? `${theme.colors.surface || theme.colors.background}10` : (theme.colors.muted || theme.colors.border || '#f3f4f6'),
        borderColor: isBold ? theme.colors.foreground : (theme.colors.border || theme.colors.foreground)
    };

    return (
        <div className="relative">
            {/* Floating Badge */}
            {showBadge && (
                <div className={isGlass ? 'mb-4' : 'absolute -top-5 left-1/2 -translate-x-1/2 z-20 w-max'}>
                    {isGlass ? (
                        <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: theme.colors.muted || theme.colors.foreground, opacity: theme.colors.muted ? 1 : 0.5 }}>{badgeText}</span>
                    ) : !isBold ? (
                        <div
                            className="px-4 py-1 rounded-full shadow-sm flex items-center gap-2"
                            style={{ ...badgeStyle, fontFamily: theme.fonts.body }}
                        >
                            <Sparkles size={14} className="fill-current" />
                            <span className="font-bold uppercase tracking-wider text-xs">{badgeText}</span>
                        </div>
                    ) : (
                        <div
                            className="border-[3px] px-6 py-2 rounded-full rotate-[-2deg] flex items-center gap-2 animate-bounce"
                            style={{
                                ...badgeStyle,
                                boxShadow: `2px 2px 0px 0px ${theme.colors.foreground}`,
                                fontFamily: theme.fonts.body
                            }}
                        >
                            <Sparkles size={20} className="fill-current" />
                            <span className="font-black uppercase tracking-wider text-sm">{badgeText}</span>
                            <Sparkles size={20} className="fill-current" />
                        </div>
                    )}
                </div>
            )}

            {/* Card Container */}
            <div
                className={`
                    group relative transition-all duration-300 p-4
                    ${!isBold ? 'hover:shadow-md' : 'hover:-translate-y-1'}
                    ${isGlass ? 'backdrop-blur-md' : ''}
                    ${isBold ? 'border-[3px]' : 'border'}
                `}
                style={containerStyle}
            >

                {/* Image Container */}
                <div
                    className={`
                        w-full aspect-[4/3] overflow-hidden mb-5 relative
                        ${isBold ? 'border-[3px]' : ''}
                    `}
                    style={imageContainerStyle}
                >

                    {/* Skeleton Loader */}
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                            <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
                            <ImageIcon className="w-16 h-16 relative z-20" strokeWidth={2} style={{ color: theme.colors.border || theme.colors.foreground, opacity: 0.4 }} />
                        </div>
                    )}

                    {/* Fullscreen Button */}
                    {showGallery && (
                        <button
                            onClick={(e) => { e.stopPropagation(); track({ type: 'view_all_click', id: 'catalog', siteId }); setIsFullScreenOpen(true); }}
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
                            className={`object-cover transition-all duration-700 group-hover:scale-105 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                        />
                    ) : (
                        <div className="flex items-center justify-center w-full h-full" style={{ color: theme.colors.border || theme.colors.foreground, opacity: 0.4 }}>
                            <ImageIcon className="w-16 h-16" />
                        </div>
                    )}

                    {/* Price Tag */}
                    {(product as any).showPrice !== false && (
                        <div className={`
                        absolute bottom-4 right-4 z-20
                        ${isBold ? 'px-4 py-2 rounded-xl border-2 font-black text-xl rotate-[-3deg] group-hover:rotate-0 transition-transform' : ''}
                    `}
                            style={isBold ? {
                                backgroundColor: theme.colors.foreground,
                                color: theme.colors.primary,
                                borderColor: theme.colors.primary,
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontFamily: theme.fonts.heading
                            } : { fontFamily: theme.fonts.body }}
                        >
                            {!isBold ? (
                                <div
                                    className="px-3 py-1.5 rounded-lg font-bold text-lg border shadow-sm backdrop-blur-md"
                                    style={{
                                        backgroundColor: `${theme.colors.surface || theme.colors.background}E6`,
                                        color: theme.colors.foreground,
                                        borderColor: theme.colors.border || theme.colors.foreground
                                    }}
                                >
                                    {product.price}
                                </div>
                            ) : product.price}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="text-center px-2 pb-2">
                    <h3
                        className={`mb-3 uppercase leading-none tracking-tight ${!isBold ? 'font-bold text-2xl' : 'font-black text-3xl'}`}
                        style={{ color: theme.colors.foreground, fontFamily: theme.fonts.heading }}
                    >
                        {product.name}
                    </h3>



                    <button
                        onClick={handleOrderClick}
                        className={`
                            w-full py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300
                        `}
                        style={{
                            borderRadius: 'calc(var(--theme-radius) * 0.6)',
                            backgroundColor: isBold ? theme.colors.foreground : theme.colors.primary,
                            color: isBold ? theme.colors.background : primaryContrastColor,
                            border: isBold ? `3px solid ${theme.colors.foreground}` : `1px solid ${theme.colors.border || theme.colors.primary}`,
                            boxShadow: isBold ? `4px 4px 0px 0px ${theme.colors.border}` : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontWeight: isBold ? 800 : 700,
                            textTransform: isBold ? 'uppercase' : 'none',
                            letterSpacing: isBold ? '0.05em' : 'normal',
                            fontFamily: theme.fonts.heading
                        }}
                    >
                        {buttonText} <ArrowRight size={24} strokeWidth={isBold ? 3 : 2} />
                    </button>
                </div>
            </div >

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
        </div >
    );
};

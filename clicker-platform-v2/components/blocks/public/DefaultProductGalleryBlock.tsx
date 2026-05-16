'use client';

import React, { useState } from 'react';
import { Product } from '@/data/mockData';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductDetailModal } from '@/components/catalog/ProductDetailModal';
import { useSite } from '@/lib/site-context';

import { useTemplate } from '@/components/TemplateProvider';
import { getHeadingColor, getLabelColor } from './cardStyles';
import { H4, BUTTON_TEXT } from './typography';

interface ProductGalleryProps {
    products: Product[];
    title?: string;
    viewAllHref?: string;
    phoneNumber?: string;
    whatsappSettings?: any;
}

export const DefaultProductGalleryBlock: React.FC<ProductGalleryProps> = ({ products, title = "Popular Treats", viewAllHref, phoneNumber, whatsappSettings }) => {
    const { siteId } = useSite();
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';
    const isBold = !isClean && !isGlass;
    const colors = theme.colors;

    // Contrast color for text/icons on top of theme.primary.
    const primaryContrastColor =
        colors.accentForeground ??
        (colors.accent && colors.accent !== colors.primary ? colors.accent : undefined) ??
        colors.background ??
        '#ffffff';

    const handleProductClick = (product: Product) => {
        setSelectedProduct(product);
    };

    const titleContainerStyle: React.CSSProperties = isBold
        ? {
            borderColor: colors.foreground,
            boxShadow: `4px 4px 0px ${colors.foreground}`,
            backgroundColor: colors.surface || colors.background,
            borderRadius: '9999px',
        }
        : isClean
            ? {
                borderRadius: '9999px',
                backgroundColor: colors.surface || colors.background,
                borderColor: colors.border || `${colors.foreground}1a`,
            }
            : {};

    return (
        <div className="mb-12">
            {/* Section Title */}
            {title && (
                <div className={isGlass ? 'mb-6' : 'flex justify-center mb-6'}>
                    {isGlass ? (
                        <h2 className={H4} style={{ color: getLabelColor(theme.cardStyle, theme) }}>
                            {title}
                        </h2>
                    ) : (
                        <div
                            className={`px-8 py-3 transition-transform ${isClean ? 'shadow-sm border' : 'border-[3px] rotate-1 hover:rotate-0'}`}
                            style={titleContainerStyle}
                        >
                            <h2 className={H4} style={{ color: getHeadingColor(theme.cardStyle, theme) }}>
                                {title}
                            </h2>
                        </div>
                    )}
                </div>
            )}



            {/* Grid Layout */}
            <div className={`grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 ${isClean || isGlass ? 'gap-y-6' : ''}`}>
                {products.map((product, index) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        onClick={() => handleProductClick(product)}
                        className={isClean || isGlass ? '' : (index % 2 === 0 ? 'rotate-1' : '-rotate-1')}
                        templateId={templateId}
                    />
                ))}
            </div>

            {/* View All Button */}
            {viewAllHref && (
                <div className="mt-8 flex justify-center">
                    <a
                        href={viewAllHref}
                        className={`inline-flex items-center gap-2 px-8 py-3 ${BUTTON_TEXT} transition-all hover:opacity-90 ${isGlass ? 'backdrop-blur-sm' : ''}`}
                        style={{
                            backgroundColor: isClean
                                ? 'transparent'
                                : isGlass
                                    ? 'rgba(255,255,255,0.10)'
                                    : colors.foreground,
                            color: isClean
                                ? colors.foreground
                                : isGlass
                                    ? 'rgba(255,255,255,0.95)'
                                    : colors.background,
                            border: isClean
                                ? `2px solid ${colors.foreground}`
                                : isGlass
                                    ? '1px solid rgba(255,255,255,0.2)'
                                    : `3px solid ${colors.foreground}`,
                            borderRadius: 'calc(var(--theme-radius) * 0.75)',
                            boxShadow: isBold
                                ? `4px 4px 0px ${colors.border || colors.foreground}`
                                : isClean
                                    ? '0 1px 3px 0 rgb(0 0 0 / 0.1)'
                                    : undefined,
                        }}
                    >
                        View More ...
                    </a>
                </div>
            )}

            <ProductDetailModal
                product={selectedProduct}
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                phoneNumber={phoneNumber}
                whatsappSettings={whatsappSettings}
            />
        </div>
    );
};

export { DefaultProductGalleryBlock as ProductGallery };

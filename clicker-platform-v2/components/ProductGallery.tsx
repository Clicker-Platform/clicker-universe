'use client';

import React, { useState } from 'react';
import { Product } from '@/data/mockData';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductDetailModal } from '@/components/catalog/ProductDetailModal';
import { useSite } from '@/lib/site-context';

import { useTemplate } from '@/components/TemplateProvider';

interface ProductGalleryProps {
    products: Product[];
    title?: string;
    viewAllHref?: string;
    phoneNumber?: string;
    whatsappSettings?: any;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ products, title = "Popular Treats", viewAllHref, phoneNumber, whatsappSettings }) => {
    const { siteId } = useSite();
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    const handleProductClick = (product: Product) => {
        setSelectedProduct(product);
    };

    const containerStyle = !isClean
        ? {
            borderColor: theme.colors.foreground,
            boxShadow: `4px 4px 0px ${theme.colors.foreground}`,
        }
        : {};

    const textStyle = {
        color: theme.colors.foreground,
        fontFamily: theme.fonts.heading
    };

    return (
        <div className="mb-12">
            {/* Section Title */}
            {title && (
                <div className={isGlass ? 'mb-6' : 'flex justify-center mb-6'}>
                    {isGlass ? (
                        <h2 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
                            {title}
                        </h2>
                    ) : (
                        <div
                            className={`
                            px-8 py-3 rounded-full transition-transform
                            ${theme.cardStyle === 'clean'
                                    ? 'bg-white shadow-sm border border-gray-200'
                                    : 'bg-brand-white border-[3px] rotate-1 hover:rotate-0'
                                }
                        `}
                            style={theme.cardStyle === 'brutalist' ? containerStyle : {}}
                        >
                            <h2
                                className="font-extrabold uppercase tracking-wider text-base"
                                style={textStyle}
                            >
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
                        className={`inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-colors ${
                            isClean
                                ? 'bg-transparent text-gray-800 border-2 border-gray-800 hover:bg-gray-800 hover:text-white'
                                : isGlass
                                    ? 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                                    : 'bg-brand-dark text-white hover:bg-brand-green hover:text-brand-dark shadow-sm'
                        }`}

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

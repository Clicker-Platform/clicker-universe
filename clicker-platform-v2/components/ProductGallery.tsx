'use client';

import React, { useState } from 'react';
import { Product } from '@/data/mockData';
import { useAnalytics } from '@/hooks/useAnalytics';
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
    const { track } = useAnalytics();
    const { siteId } = useSite();
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';

    const handleProductClick = (product: Product) => {
        track({ type: 'product_click', id: product.id, siteId });
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
                <div className="flex justify-center mb-6">
                    <div
                        className={`
                        px-8 py-3 rounded-full transition-transform
                        ${isClean
                                ? 'bg-white shadow-sm border border-gray-200'
                                : 'bg-brand-white border-[3px] rotate-1 hover:rotate-0'
                            }
                    `}
                        style={!isClean ? containerStyle : {}}
                    >
                        <h2
                            className="font-extrabold uppercase tracking-wider text-base"
                            style={textStyle}
                        >
                            {title}
                        </h2>
                    </div>
                </div>
            )}



            {/* Grid Layout */}
            <div className={`grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 ${isClean ? 'gap-y-6' : ''}`}>
                {products.map((product, index) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        onClick={() => handleProductClick(product)}
                        className={isClean ? '' : (index % 2 === 0 ? 'rotate-1' : '-rotate-1')}
                        layoutStyle={templateId}
                    />
                ))}
            </div>

            {/* View All Button */}
            {viewAllHref && (
                <div className="mt-8 flex justify-center">
                    <a
                        href={viewAllHref}
                        className={`inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-colors ${isClean
                            ? 'bg-transparent text-brand-dark border-2 border-brand-dark hover:bg-brand-dark hover:text-white'
                            : 'bg-brand-dark text-white hover:bg-brand-green hover:text-brand-dark shadow-sm'
                            }`}
                        onClick={() => track({ type: 'view_all_click', id: 'catalog', siteId })}
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

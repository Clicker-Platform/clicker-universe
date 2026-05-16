'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Product } from '@/data/mockData';
import { ProductDetailModal } from '@/components/catalog/ProductDetailModal';
import { useTemplate } from '@/components/TemplateProvider';
import { getCardClasses, getHeadingColor, getLabelColor, getMutedColor } from './cardStyles';
import { H3, H4, BODY_SM } from './typography';

// 1x1 gray SVG placeholder — shown while the real image downloads
const BLUR_PLACEHOLDER =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';

interface ProductsBlockClientProps {
    data: any;
    products: Product[];
    phoneNumber?: string;
    whatsappSettings?: any;
}

function ProductTile({ product, onClick, priority, cardStyle }: {
    product: Product;
    onClick: () => void;
    priority: boolean;
    cardStyle: string;
}) {
    const [loaded, setLoaded] = useState(false);
    const { theme } = useTemplate();
    const isGlass = theme.cardStyle === 'glass';
    const headingColor = getHeadingColor(theme.cardStyle, theme);
    const labelColor = getLabelColor(theme.cardStyle, theme);
    const mutedColor = getMutedColor(theme.cardStyle, theme);

    const imageUrl = product.imageUrl || (product as any).image;
    const showPrice = (product as any).showPrice !== false;
    const showLabel = (product as any).showLabel !== false;

    return (
        <div
            onClick={onClick}
            className={`flex flex-col gap-3 p-3 cursor-pointer group transition-all duration-300 ${cardStyle} hover:-translate-y-1`}
            style={{ borderRadius: 'var(--theme-radius)' }}
        >
            {/* Image */}
            <div
                className="w-full aspect-[4/3] relative overflow-hidden flex-shrink-0"
                style={{ borderRadius: 'calc(var(--theme-radius) * 0.65)' }}
            >
                {/* Shimmer while loading */}
                {!loaded && (
                    <div
                        className={`absolute inset-0 z-10 ${isGlass ? 'bg-white/10' : 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200'}`}
                        style={!isGlass ? { animation: 'shimmer 1.4s infinite linear', backgroundSize: '200% 100%' } : {}}
                    />
                )}
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={product.name}
                        fill
                        priority={priority}
                        placeholder="blur"
                        blurDataURL={BLUR_PLACEHOLDER}
                        onLoad={() => setLoaded(true)}
                        sizes="(max-width: 768px) 50vw, 240px"
                        className={`object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                ) : (
                    <div className="w-full h-full" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col min-w-0 px-1 pb-1">
                {showLabel && product.category && (
                    <span
                        className={`${H4} mb-1`}
                        style={{ color: labelColor }}
                    >
                        {product.category}
                    </span>
                )}
                <h3
                    className={`${H3} mb-1 group-hover:opacity-80 transition-opacity truncate`}
                    style={{ color: headingColor }}
                >
                    {product.name || (product as any).title}
                </h3>
                {showPrice && (
                    <p
                        className={BODY_SM}
                        style={{ color: mutedColor }}
                    >
                        {product.price}
                    </p>
                )}
            </div>
        </div>
    );
}

export const ProductsBlockClient = ({ data, products, phoneNumber, whatsappSettings }: ProductsBlockClientProps) => {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const { theme } = useTemplate();
    const cardStyle = getCardClasses(theme.cardStyle);

    return (
        <section>
            {data.title && (
                <h2
                    className={`${H4} mb-6`}
                    style={{ color: getLabelColor(theme.cardStyle, theme) }}
                >
                    {data.title}
                </h2>
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                {products.map((product, idx) => (
                    <ProductTile
                        key={product.id}
                        product={product}
                        onClick={() => setSelectedProduct(product)}
                        priority={idx < 4}
                        cardStyle={cardStyle}
                    />
                ))}
            </div>

            <ProductDetailModal
                product={selectedProduct}
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                phoneNumber={phoneNumber}
                whatsappSettings={whatsappSettings}
            />
        </section>
    );
};

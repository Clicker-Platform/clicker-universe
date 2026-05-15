'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Product } from '@/data/mockData';
import { ProductDetailModal } from '@/components/catalog/ProductDetailModal';
import { useTemplate } from '@/components/TemplateProvider';
import { getCardClasses, getTextColor } from './cardStyles';

// 1x1 gray SVG placeholder — shown while the real image downloads
const BLUR_PLACEHOLDER =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';

interface ProductsBlockClientProps {
    data: Record<string, unknown>;
    products: Product[];
    phoneNumber?: string;
    whatsappSettings?: Record<string, unknown>;
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

    const imageUrl = product.imageUrl;
    const showPrice = product.showPrice !== false;
    const showLabel = product.showLabel !== false;

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
                        className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${getTextColor(theme.cardStyle, true)}`}
                        style={{ fontFamily: theme.fonts.body }}
                    >
                        {product.category}
                    </span>
                )}
                <h3
                    className={`font-bold text-sm leading-tight mb-1 group-hover:opacity-80 transition-opacity truncate ${getTextColor(theme.cardStyle)}`}
                    style={{ fontFamily: theme.fonts.heading }}
                >
                    {product.name}
                </h3>
                {showPrice && (
                    <p
                        className={`text-xs font-medium ${getTextColor(theme.cardStyle, true)}`}
                        style={{ fontFamily: theme.fonts.body }}
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
            {Boolean(data.title) && (
                <h2
                    className="text-xs font-bold uppercase tracking-[0.2em] mb-6 opacity-60"
                    style={{ fontFamily: theme.fonts.heading, color: theme.colors.foreground }}
                >
                    {data.title as string}
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

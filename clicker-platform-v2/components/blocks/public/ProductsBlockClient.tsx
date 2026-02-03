'use client';

import React, { useState } from 'react';
import { Product } from '@/data/mockData';
import { ProductDetailModal } from '@/components/catalog/ProductDetailModal';
import { useTemplate } from '@/components/TemplateProvider';
import Image from 'next/image';

interface ProductsBlockClientProps {
    data: any;
    products: Product[];
    phoneNumber?: string;
    whatsappSettings?: any;
}

export const ProductsBlockClient = ({ data, products, phoneNumber, whatsappSettings }: ProductsBlockClientProps) => {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const { templateId, theme } = useTemplate();
    const isBold = theme.cardStyle !== 'clean';

    return (
        <section className="">
            {data.title && (
                <h2
                    className={`text-2xl font-black mb-4 px-2`}
                    style={{ fontFamily: theme.fonts.heading, color: theme.colors.foreground }}
                >
                    {data.title}
                </h2>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
                {products.map(product => {
                    // Dynamic card styles
                    const cardStyle = {
                        borderRadius: `var(--theme-radius)`,
                        borderColor: isBold ? theme.colors.foreground : 'rgba(0,0,0,0.1)',
                        boxShadow: isBold ? `4px 4px 0px 0px ${theme.colors.border}` : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                        backgroundColor: '#FFFFFF'
                    };

                    // Scale down radius for image since it's inside
                    const imageStyle = {
                        borderRadius: `calc(var(--theme-radius) * 0.75)`,
                        borderColor: isBold ? theme.colors.foreground : 'rgba(0,0,0,0.1)',
                        borderWidth: isBold ? '3px' : '1px'
                    };

                    const showPrice = (product as any).showPrice !== false;
                    const showLabel = (product as any).showLabel !== false;

                    return (
                        <div
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            className={`
                                p-4 flex flex-col gap-4 cursor-pointer group transition-all duration-300
                                ${isBold ? 'border-[3px] hover:-translate-y-1' : 'border hover:shadow-md'}
                            `}
                            style={cardStyle}
                        >
                            <div
                                className="w-full aspect-[4/3] bg-gray-100 flex-shrink-0 overflow-hidden relative"
                                style={imageStyle}
                            >
                                {(product.imageUrl || (product as any).image) && (
                                    <Image
                                        src={product.imageUrl || (product as any).image}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        className="object-cover"
                                    />
                                )}
                            </div>
                            <div className="flex-1 flex flex-col justify-start min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    <h3
                                        className="font-bold text-xl leading-tight mb-2 group-hover:opacity-80 transition-opacity"
                                        style={{ fontFamily: theme.fonts.heading, color: theme.colors.foreground }}
                                    >
                                        {product.name || (product as any).title}
                                    </h3>
                                    {showLabel && product.category && (
                                        <span className="text-xs font-bold uppercase tracking-wider opacity-60 bg-gray-100 px-2 py-1 rounded" style={{ fontFamily: theme.fonts.body, color: theme.colors.foreground }}>
                                            {product.category}
                                        </span>
                                    )}
                                </div>
                                {showPrice && (
                                    <p
                                        className="font-medium text-lg"
                                        style={{ fontFamily: theme.fonts.body, color: theme.colors.foreground, opacity: 0.7 }}
                                    >
                                        {product.price}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
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

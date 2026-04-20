'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { Product } from '@/data/mockData';

interface ProductCardProps {
    product: Product;
    onClick?: () => void;
    className?: string;
    templateId?: string;
}

import { useTemplate } from '@/components/TemplateProvider';
import { getGlassStyle } from '@/components/blocks/public/cardStyles';

function ProductCardComponent({ product, onClick, className = '' }: ProductCardProps) {
    const { theme, templateId } = useTemplate(); // Use context

    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';
    const isBrutalist = !isClean && !isGlass;

    // Dynamic Styles from Theme
    const cardStyle = isBrutalist
        ? {
            borderColor: theme.colors.accent,
            boxShadow: `4px 4px 0px ${theme.colors.accent}`
        }
        : {};

    const priceTagStyle = isBrutalist
        ? {
            backgroundColor: theme.colors.primary,
            color: theme.colors.accent,
            borderColor: theme.colors.accent
        }
        : isGlass
        ? {
            backgroundColor: theme.colors.primary,
            color: '#FFFFFF'
        }
        : {};

    const titleStyle = {
        color: isClean ? theme.colors.foreground : isGlass ? '#FFFFFF' : theme.colors.accent
    };

    return (
        <div
            onClick={onClick}
            className={`
                relative flex flex-col group cursor-pointer overflow-hidden
                ${isClean
                    ? 'bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow'
                    : isGlass
                    ? 'backdrop-blur-md rounded-2xl border border-white/10 shadow-xl transform transition-all duration-200 hover:-translate-y-1'
                    : 'bg-white p-3 rounded-2xl border-[3px] transform transition-all duration-200 hover:-translate-y-1'
                }
                ${className}
            `}
            style={isGlass ? { ...getGlassStyle(theme.colors.surface) } : isBrutalist ? cardStyle : {}}
        >
            {/* Price Tag */}
            {(product as any).showPrice !== false && (
                <div className={`absolute z-10 ${isClean ? 'top-3 right-3' : isGlass ? 'top-3 right-3' : 'top-0 right-0 max-w-[50%]'}`}>
                    {isClean ? (
                        <div className="bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-1 rounded-full font-bold text-xs shadow-sm border border-gray-100">
                            {product.price}
                        </div>
                    ) : isGlass ? (
                        <div className="bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full font-bold text-xs shadow-sm border border-white/10" style={priceTagStyle}>
                            {product.price}
                        </div>
                    ) : (
                        <div
                            className="border-[2px] px-2 py-1 rounded-lg font-black text-xs shadow-sm rotate-6"
                            style={priceTagStyle}
                        >
                            {product.price}
                        </div>
                    )}
                </div>
            )}

            {/* Image */}
            <div className={`
                aspect-square w-full overflow-hidden relative
                ${isClean ? 'bg-gray-100 rounded-t-xl' : isGlass ? 'bg-white/5 rounded-t-2xl' : 'bg-gray-100 rounded-xl border-[2px] mb-3'}
            `}
                style={isBrutalist ? { borderColor: theme.colors.accent } : {}}
            >
                {product.imageUrl && product.imageUrl.trim() !== '' ? (
                    <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 250px"
                        className={`object-cover transition-transform duration-500 hover:scale-110`}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300 font-bold text-4xl">
                        {product.name.charAt(0)}
                    </div>
                )}
            </div>

            {/* Title */}
            <div className={`${isClean ? 'p-4' : isGlass ? 'p-4' : ''} mt-auto`}>
                <h3 className={`
                    leading-tight
                    ${isClean ? 'font-bold text-left text-sm text-gray-800' : isGlass ? 'font-bold text-center text-sm sm:text-base' : 'font-extrabold text-center text-base sm:text-lg'}
                 `}
                    style={titleStyle}
                >
                    {product.name}
                </h3>
            </div>
        </div>
    );
}

export const ProductCard = memo(ProductCardComponent);

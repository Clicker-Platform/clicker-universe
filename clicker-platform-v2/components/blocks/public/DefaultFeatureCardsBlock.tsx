'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView } from '@/components/DeviceViewContext';
import { MediaView } from './MediaView';
import { getCardClasses } from './cardStyles';
import type { FeatureCardsData, FeatureCard } from '@/components/blocks/feature-cards/types';

function isLightColor(hex: string): boolean {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return true;
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5;
}

const COLS_CLASS: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
};

interface CardItemProps {
    card: FeatureCard;
    cardStyle?: string;
}

function CardItem({ card, cardStyle }: CardItemProps) {
    const hasCustomBg = !!card.bgColor;

    const autoTextColor = card.bgColor
        ? (card.textColor || (isLightColor(card.bgColor) ? '#111111' : '#ffffff'))
        : undefined;

    const cardClass = hasCustomBg
        ? 'rounded-2xl overflow-hidden flex flex-col h-full'
        : `rounded-2xl overflow-hidden flex flex-col h-full ${getCardClasses(cardStyle)}`;

    const inlineStyle = hasCustomBg
        ? { backgroundColor: card.bgColor, color: autoTextColor }
        : undefined;

    const labelColor = hasCustomBg
        ? (autoTextColor ? `${autoTextColor}99` : 'rgba(255,255,255,0.6)')
        : undefined;

    const bodyColor = hasCustomBg
        ? (autoTextColor ? `${autoTextColor}cc` : 'rgba(255,255,255,0.8)')
        : undefined;

    const tagBg = hasCustomBg ? 'rgba(255,255,255,0.15)' : undefined;
    const tagText = hasCustomBg ? autoTextColor : undefined;

    return (
        <div className={cardClass} style={inlineStyle}>
            {card.media?.src && (
                <MediaView media={card.media} />
            )}
            <div className="flex flex-col gap-2 p-4 flex-1">
                {card.label && (
                    <span
                        className="text-xs font-bold tracking-widest uppercase"
                        style={labelColor ? { color: labelColor } : { color: 'var(--theme-muted-foreground, #6b7280)' }}
                    >
                        {card.label}
                    </span>
                )}
                <h3
                    className="text-xl font-black leading-tight"
                    style={hasCustomBg ? { color: autoTextColor } : { color: 'var(--theme-foreground)' }}
                >
                    {card.headline}
                </h3>
                {card.body && (
                    <p
                        className="text-sm leading-relaxed"
                        style={bodyColor ? { color: bodyColor } : { color: 'var(--theme-muted-foreground, #6b7280)' }}
                    >
                        {card.body}
                    </p>
                )}
                {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                        {card.tags.map((tag, i) => (
                            <span
                                key={i}
                                className="px-3 py-1 rounded-full text-xs font-medium"
                                style={
                                    tagBg
                                        ? { backgroundColor: tagBg, color: tagText }
                                        : { backgroundColor: 'var(--theme-muted, #f3f4f6)', color: 'var(--theme-foreground)' }
                                }
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface DefaultFeatureCardsBlockProps {
    data: FeatureCardsData;
    theme?: any;
    previewMode?: boolean;
}

export function DefaultFeatureCardsBlock({ data, theme: themeProp, previewMode: _previewMode }: DefaultFeatureCardsBlockProps) {
    const { theme: contextTheme } = useTemplate();
    const theme = themeProp ?? contextTheme;
    const deviceView = useDeviceView();
    const isMobile = deviceView === 'mobile';

    if (!data) return null;

    const columns = data.columns || 3;
    const colsClass = COLS_CLASS[columns] || COLS_CLASS[3];
    const cards = data.cards || [];

    return (
        <section className="w-full py-8">
            {(data.title || data.subtitle) && (
                <div className="mb-8 px-4 text-center">
                    {data.title && (
                        <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--theme-foreground)' }}>
                            {data.title}
                        </h2>
                    )}
                    {data.subtitle && (
                        <p className="mt-2 text-base" style={{ color: 'var(--theme-muted-foreground, #6b7280)' }}>
                            {data.subtitle}
                        </p>
                    )}
                </div>
            )}
            {cards.length > 0 && (
                isMobile ? (
                    <div className="flex items-stretch gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {cards.map((card) => (
                            <div key={card.id} className="snap-start shrink-0 w-[72vw] max-w-[260px] flex flex-col">
                                <CardItem card={card} cardStyle={theme?.cardStyle} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 ${colsClass} gap-4 items-stretch px-4`}>
                        {cards.map((card) => (
                            <CardItem key={card.id} card={card} cardStyle={theme?.cardStyle} />
                        ))}
                    </div>
                )
            )}
        </section>
    );
}

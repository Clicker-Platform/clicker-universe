'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { MediaView } from './MediaView';
import { getCardClasses, getHeadingColor, getBodyColor, getMutedColor, getLabelColor, hexWithOpacity } from './cardStyles';
import { H2, H3, H4, BODY, BODY_SM } from './typography';
import type { FeatureCardsData, FeatureCard } from '@/components/blocks/feature-cards/types';

function isLightColor(hex: string): boolean {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return true;
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5;
}

const DESKTOP_COLS_CLASS: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
};

interface CardItemProps {
    card: FeatureCard;
    cardStyle?: string;
    theme: any;
}

function CardItem({ card, cardStyle, theme }: CardItemProps) {
    const hasCustomBg = !!card.bgColor;

    // Per-card bgColor override → derive contrast text color via luminance.
    // This is the spec-allowed exception in §3.1 (user-uploaded surface colors).
    const autoTextColor = card.bgColor
        ? (card.textColor || (isLightColor(card.bgColor) ? '#111111' : '#ffffff'))
        : undefined;

    const cardClass = hasCustomBg
        ? 'rounded-2xl overflow-hidden flex flex-col h-full'
        : `rounded-2xl overflow-hidden flex flex-col h-full ${getCardClasses(cardStyle)}`;

    const inlineStyle = hasCustomBg
        ? { backgroundColor: card.bgColor, color: autoTextColor }
        : undefined;

    const headingColor = hasCustomBg ? autoTextColor! : getHeadingColor(cardStyle, theme);
    const labelColor = hasCustomBg ? hexWithOpacity(autoTextColor!, 0.6) : getLabelColor(cardStyle, theme);
    const bodyColor = hasCustomBg ? hexWithOpacity(autoTextColor!, 0.8) : getMutedColor(cardStyle, theme);

    const tagBg = hasCustomBg ? 'rgba(255,255,255,0.15)' : 'var(--theme-surface)';
    const tagText = hasCustomBg ? autoTextColor : getBodyColor(cardStyle, theme);

    return (
        <div className={cardClass} style={inlineStyle}>
            {card.media?.src && (
                <MediaView media={card.media} />
            )}
            <div className="flex flex-col gap-2 p-4 flex-1">
                {card.label && (
                    <span className={H4} style={{ color: labelColor }}>
                        {card.label}
                    </span>
                )}
                <h3 className={H3} style={{ color: headingColor }}>
                    {card.headline}
                </h3>
                {card.body && (
                    <p className={BODY_SM} style={{ color: bodyColor }}>
                        {card.body}
                    </p>
                )}
                {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                        {card.tags.map((tag, i) => (
                            <span
                                key={i}
                                className="px-3 py-1 rounded-full text-xs font-medium"
                                style={{ backgroundColor: tagBg, color: tagText }}
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
    const theme = (themeProp && typeof themeProp === 'object') ? themeProp : contextTheme;
    const deviceView = useDeviceView();

    if (!data) return null;

    const columns = data.columns || 3;
    const desktopCols = DESKTOP_COLS_CLASS[columns] || DESKTOP_COLS_CLASS[3];
    const cards = data.cards || [];

    // Mobile: horizontal scroll. Desktop: grid.
    // dv() emits the right classes for canvas previews + responsive viewport.
    const containerClass = dv(
        deviceView,
        'flex items-stretch gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        `md:grid ${desktopCols} md:gap-4 md:items-stretch md:px-4 md:max-w-6xl md:mx-auto md:overflow-visible md:pb-0`
    );

    return (
        <section className="w-full min-w-0 py-8">
            {(data.title || data.subtitle) && (
                <div className="mb-8 px-4 text-center max-w-2xl mx-auto">
                    {data.title && (
                        <h2 className={H2} style={{ color: getHeadingColor(theme?.cardStyle, theme) }}>
                            {data.title}
                        </h2>
                    )}
                    {data.subtitle && (
                        <p className={`${BODY} mt-2`} style={{ color: getMutedColor(theme?.cardStyle, theme) }}>
                            {data.subtitle}
                        </p>
                    )}
                </div>
            )}
            {cards.length > 0 && (
                <div className={containerClass}>
                    {cards.map((card) => {
                        const cardWrapperClass = dv(
                            deviceView,
                            'snap-start shrink-0 w-[72vw] max-w-[280px] flex flex-col',
                            'md:w-auto md:max-w-none flex flex-col'
                        );
                        return (
                            <div key={card.id} className={cardWrapperClass}>
                                <CardItem card={card} cardStyle={theme?.cardStyle} theme={theme} />
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

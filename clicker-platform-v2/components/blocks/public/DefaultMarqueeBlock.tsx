'use client';

import React from 'react';
import { ICON_MAP } from '@/data/icons';
import { Star } from 'lucide-react';
import {
    MarqueeBlockData,
    MarqueeItem,
    MARQUEE_SPEED_SECONDS,
    MARQUEE_ICON_PX,
    MARQUEE_GAP_PX,
    MARQUEE_MASK_GUTTER_PX,
} from '@/components/blocks/marquee/types';
import { SafeSvgIcon } from './SafeSvgIcon';

interface DefaultMarqueeBlockProps {
    data: MarqueeBlockData;
}

function renderIcon(item: MarqueeItem, sizePx: number): React.ReactNode {
    if (item.icon.kind === 'svg') {
        return <SafeSvgIcon svg={item.icon.svg} className="marquee-icon" />;
    }
    const LucideIcon = ICON_MAP[item.icon.name] ?? Star;
    return <LucideIcon size={sizePx} aria-hidden="true" />;
}

export const DefaultMarqueeBlock: React.FC<DefaultMarqueeBlockProps> = ({ data }) => {
    const items = data?.items ?? [];
    if (items.length === 0) {
        return (
            <div className="text-sm text-gray-400 italic px-4 py-3">
                Marquee has no items yet. Add items in the right panel.
            </div>
        );
    }

    const durationSec = MARQUEE_SPEED_SECONDS[data.speed] ?? 30;
    const iconPx = MARQUEE_ICON_PX[data.iconSize] ?? 20;
    const gapPx = MARQUEE_GAP_PX[data.itemGap] ?? 48;
    const animationName = data.direction === 'right' ? 'marquee-right' : 'marquee-left';

    const maskImage = `linear-gradient(to right, transparent 0, black ${MARQUEE_MASK_GUTTER_PX}px, black calc(100% - ${MARQUEE_MASK_GUTTER_PX}px), transparent 100%)`;

    const doubled = [...items, ...items];

    const wrapperStyle: React.CSSProperties = {
        overflow: 'hidden',
        WebkitMaskImage: maskImage,
        maskImage,
        color: data.color || 'inherit',
        fontSize: `${iconPx}px`,
    };

    const trackStyle: React.CSSProperties = {
        display: 'flex',
        width: 'max-content',
        gap: `${gapPx}px`,
        animation: `${animationName} ${durationSec}s linear infinite`,
    };

    const itemStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(gapPx / 4)}px`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        const track = e.currentTarget.querySelector('.marquee-track') as HTMLElement | null;
        if (track) track.style.animationPlayState = 'paused';
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        const track = e.currentTarget.querySelector('.marquee-track') as HTMLElement | null;
        if (track) track.style.animationPlayState = 'running';
    };

    return (
        <div className="marquee-wrapper" style={wrapperStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <div className="marquee-track" style={trackStyle}>
                {doubled.map((item, idx) => (
                    <span key={`${item.id}-${idx}`} className="marquee-item" style={itemStyle}>
                        {renderIcon(item, iconPx)}
                        <span style={{ fontSize: `${Math.max(12, Math.round(iconPx * 0.8))}px`, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {item.label}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
};

export default DefaultMarqueeBlock;

// components/blocks/public/DefaultMarqueeBlock.tsx
'use client';

import React from 'react';
import { ICON_MAP } from '@/data/icons';
import { Star } from 'lucide-react';
import {
    MarqueeBlockData,
    MarqueeItem,
    MARQUEE_ICON_PX,
    MARQUEE_GAP_PX,
} from '@/components/blocks/marquee/types';
import { SafeSvgIcon } from './SafeSvgIcon';
import { MarqueeTrack } from '@/components/blocks/shared/MarqueeTrack';

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

    const iconPx = MARQUEE_ICON_PX[data.iconSize] ?? 20;
    const gapPx = MARQUEE_GAP_PX[data.itemGap] ?? 48;

    const itemStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(gapPx / 4)}px`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
    };

    const wrapperStyle: React.CSSProperties = {
        color: data.color || 'inherit',
        fontSize: `${iconPx}px`,
    };

    return (
        <MarqueeTrack
            direction={data.direction}
            speed={data.speed}
            pauseOnHover={true}
            gap={data.itemGap}
            style={wrapperStyle}
        >
            {items.map((item) => (
                <span key={item.id} className="marquee-item" style={itemStyle}>
                    {renderIcon(item, iconPx)}
                    <span style={{ fontSize: `${Math.max(12, Math.round(iconPx * 0.8))}px`, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {item.label}
                    </span>
                </span>
            ))}
        </MarqueeTrack>
    );
};

export default DefaultMarqueeBlock;

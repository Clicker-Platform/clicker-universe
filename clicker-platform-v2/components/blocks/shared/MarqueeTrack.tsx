// components/blocks/shared/MarqueeTrack.tsx
'use client';

import React from 'react';

export type MarqueeTrackSpeed = 'slow' | 'normal' | 'fast';
export type MarqueeTrackDirection = 'left' | 'right';
export type MarqueeTrackGap = 'tight' | 'normal' | 'loose';

interface MarqueeTrackProps {
    direction: MarqueeTrackDirection;
    speed: MarqueeTrackSpeed;
    pauseOnHover: boolean;
    gap: MarqueeTrackGap;
    children: React.ReactNode;
    /** px gutter on each side for the fade mask */
    maskGutterPx?: number;
    className?: string;
    style?: React.CSSProperties;
}

const SPEED_SECONDS: Record<MarqueeTrackSpeed, number> = {
    slow: 45,
    normal: 30,
    fast: 18,
};

const GAP_PX: Record<MarqueeTrackGap, number> = {
    tight: 32,
    normal: 48,
    loose: 72,
};

export const MarqueeTrack: React.FC<MarqueeTrackProps> = ({
    direction,
    speed,
    pauseOnHover,
    gap,
    children,
    maskGutterPx = 48,
    className,
    style,
}) => {
    const durationSec = SPEED_SECONDS[speed];
    const gapPx = GAP_PX[gap];
    const animationName = direction === 'right' ? 'marquee-right' : 'marquee-left';

    const maskImage = `linear-gradient(to right, transparent 0, black ${maskGutterPx}px, black calc(100% - ${maskGutterPx}px), transparent 100%)`;

    const wrapperStyle: React.CSSProperties = {
        overflow: 'hidden',
        WebkitMaskImage: maskImage,
        maskImage,
        ...style,
    };

    const trackStyle: React.CSSProperties = {
        display: 'flex',
        width: 'max-content',
        gap: `${gapPx}px`,
        animationName,
        animationDuration: `${durationSec}s`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationPlayState: 'running',
    };

    const hoverClass = pauseOnHover ? 'marquee-pause-on-hover' : '';

    return (
        <div className={`marquee-wrapper ${className ?? ''} ${hoverClass}`} style={wrapperStyle}>
            <div className="marquee-track" style={trackStyle}>
                {children}
                {children}
            </div>
        </div>
    );
};

export default MarqueeTrack;

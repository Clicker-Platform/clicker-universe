import { v4 as uuidv4 } from 'uuid';

export type MarqueeSpeed = 'slow' | 'normal' | 'fast';
export type MarqueeDirection = 'left' | 'right';
export type MarqueeIconSize = 'sm' | 'md' | 'lg';
export type MarqueeItemGap = 'tight' | 'normal' | 'loose';

export type MarqueeIcon =
    | { kind: 'lucide'; name: string }
    | { kind: 'svg'; svg: string };

export interface MarqueeItem {
    id: string;
    label: string;
    icon: MarqueeIcon;
}

export interface MarqueeBlockData {
    items: MarqueeItem[];
    speed: MarqueeSpeed;
    direction: MarqueeDirection;
    iconSize: MarqueeIconSize;
    itemGap: MarqueeItemGap;
    color?: string;
}

export const MARQUEE_SPEED_SECONDS: Record<MarqueeSpeed, number> = {
    slow: 45,
    normal: 30,
    fast: 18,
};

export const MARQUEE_ICON_PX: Record<MarqueeIconSize, number> = {
    sm: 16,
    md: 20,
    lg: 24,
};

export const MARQUEE_GAP_PX: Record<MarqueeItemGap, number> = {
    tight: 32,
    normal: 48,
    loose: 72,
};

export const MARQUEE_MASK_GUTTER_PX = 48;

export function makeDefaultMarqueeItem(label = 'New item', iconName = 'Star'): MarqueeItem {
    return { id: uuidv4(), label, icon: { kind: 'lucide', name: iconName } };
}

export const DEFAULT_MARQUEE_DATA: MarqueeBlockData = {
    items: [
        makeDefaultMarqueeItem('100% Online', 'Globe'),
        makeDefaultMarqueeItem('Clear Pricing', 'DollarSign'),
        makeDefaultMarqueeItem('Shipped To Your Door', 'Package'),
        makeDefaultMarqueeItem('Licensed Providers', 'Award'),
    ],
    speed: 'normal',
    direction: 'left',
    iconSize: 'md',
    itemGap: 'normal',
};

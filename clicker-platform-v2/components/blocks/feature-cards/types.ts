import { v4 as uuidv4 } from 'uuid';
import type { MediaFieldValue } from '@/components/admin/blocks/media-field/types';

export interface FeatureCard {
    id: string;
    media?: MediaFieldValue;
    /** Public small caption above the headline (the existing "label"). */
    label?: string;
    headline: string;
    body?: string;
    tags?: string[];
    bgColor?: string;
    textColor?: string;
    /** Private navigator-only label. Falls back to headline when empty. */
    navLabel?: string;
}

export interface FeatureCardsData {
    columns: 1 | 2 | 3 | 4;
    cards: FeatureCard[];
    verticalSpacing?: 'none' | 'small' | 'medium' | 'tall';
    horizontalPadding?: 'none' | 'normal' | 'wide';
    /** Card corner radius. 'theme' (default) follows the template's --theme-radius;
     *  any other value overrides it for every card in this block. */
    cornerRadius?: 'theme' | 'none' | 'small' | 'medium' | 'large';
}

export function makeDefaultCard(): FeatureCard {
    return { id: uuidv4(), headline: 'Card Headline' };
}

export const DEFAULT_FEATURE_CARDS_DATA: FeatureCardsData = {
    columns: 3,
    cards: [
        { id: uuidv4(), headline: 'First Card' },
        { id: uuidv4(), headline: 'Second Card' },
        { id: uuidv4(), headline: 'Third Card' },
    ],
};

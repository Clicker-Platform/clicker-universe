import { v4 as uuidv4 } from 'uuid';
import type { MediaFieldValue } from '@/components/admin/blocks/media-field/types';

export interface FeatureCard {
    id: string;
    media?: MediaFieldValue;
    label?: string;
    headline: string;
    body?: string;
    tags?: string[];
    bgColor?: string;
    textColor?: string;
}

export interface FeatureCardsData {
    columns: 1 | 2 | 3 | 4;
    cards: FeatureCard[];
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

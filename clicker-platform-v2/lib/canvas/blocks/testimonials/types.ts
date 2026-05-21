// lib/canvas/blocks/testimonials/types.ts
import { v4 as uuidv4 } from 'uuid';

export type TestimonialsVariant = 'single' | 'marquee';
export type TestimonialRating = 1 | 2 | 3 | 4 | 5;

export interface TestimonialItem {
    id: string;
    personName: string;
    personRole?: string;
    personPhoto?: string;
    brandName?: string;
    brandLogo?: string;
    rating?: TestimonialRating;
    content: string;
}

export interface TestimonialsBlockData {
    variant: TestimonialsVariant;
    items: TestimonialItem[];

    // marquee-only (ignored when variant === 'single')
    marqueeDirection?: 'left' | 'right';
    marqueeSpeed?: 'slow' | 'normal' | 'fast';
    marqueePauseOnHover?: boolean;
    marqueeGap?: 'tight' | 'normal' | 'loose';
}

export const TESTIMONIAL_CONTENT_SOFT_LIMIT = 400;

export function makeDefaultTestimonialItem(): TestimonialItem {
    return {
        id: uuidv4(),
        personName: '',
        content: '',
    };
}

export const DEFAULT_TESTIMONIALS_BLOCK_DATA: TestimonialsBlockData = {
    variant: 'single',
    items: [makeDefaultTestimonialItem()],
    marqueeDirection: 'left',
    marqueeSpeed: 'normal',
    marqueePauseOnHover: true,
    marqueeGap: 'normal',
};

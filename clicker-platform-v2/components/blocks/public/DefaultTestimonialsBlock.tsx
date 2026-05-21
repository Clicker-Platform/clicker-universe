'use client';

import React from 'react';
import type { TestimonialsBlockData, TestimonialItem } from '@/lib/canvas/blocks/testimonials/types';
import { TestimonialCard } from '@/components/blocks/shared/TestimonialCard';
import { MarqueeTrack } from '@/components/blocks/shared/MarqueeTrack';

interface DefaultTestimonialsBlockProps {
    data: TestimonialsBlockData;
}

const EmptyHint: React.FC = () => (
    <div className="text-sm text-gray-400 italic px-4 py-3">
        No testimonials yet. Add one in the right panel.
    </div>
);

const TestimonialsSingle: React.FC<{ item: TestimonialItem }> = ({ item }) => (
    <div data-testimonial-id={item.id}>
        <TestimonialCard item={item} size="lg" />
    </div>
);

const TestimonialsMarquee: React.FC<{ data: TestimonialsBlockData }> = ({ data }) => (
    <MarqueeTrack
        direction={data.marqueeDirection ?? 'left'}
        speed={data.marqueeSpeed ?? 'normal'}
        pauseOnHover={data.marqueePauseOnHover ?? true}
        gap={data.marqueeGap ?? 'normal'}
    >
        {data.items.map((item) => (
            <div
                key={item.id}
                data-testimonial-id={item.id}
                style={{ flexShrink: 0, width: 320 }}
            >
                <TestimonialCard item={item} size="sm" />
            </div>
        ))}
    </MarqueeTrack>
);

export const DefaultTestimonialsBlock: React.FC<DefaultTestimonialsBlockProps> = ({ data }) => {
    const items = data?.items ?? [];

    if (items.length === 0) {
        return <EmptyHint />;
    }

    if (data.variant === 'single') {
        return <TestimonialsSingle item={items[0]} />;
    }

    return <TestimonialsMarquee data={data} />;
};

export default DefaultTestimonialsBlock;

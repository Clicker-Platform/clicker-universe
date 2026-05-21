import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DefaultTestimonialsBlock } from '../DefaultTestimonialsBlock';
import type { TestimonialsBlockData } from '@/lib/canvas/blocks/testimonials/types';

const singleData: TestimonialsBlockData = {
    variant: 'single',
    items: [{ id: 'a', personName: 'Alice', content: 'Loved it.' }],
};

const marqueeData: TestimonialsBlockData = {
    variant: 'marquee',
    items: [
        { id: 'a', personName: 'Alice', content: 'Loved it.' },
        { id: 'b', personName: 'Bob', content: 'Great.' },
    ],
    marqueeDirection: 'left',
    marqueeSpeed: 'normal',
    marqueePauseOnHover: true,
    marqueeGap: 'normal',
};

describe('DefaultTestimonialsBlock', () => {
    it('renders single variant with one card', () => {
        render(<DefaultTestimonialsBlock data={singleData} />);
        expect(screen.getByText('Loved it.')).toBeInTheDocument();
        expect(screen.queryByText('Great.')).not.toBeInTheDocument();
    });

    it('renders marquee variant with all items (doubled by MarqueeTrack)', () => {
        const { container } = render(<DefaultTestimonialsBlock data={marqueeData} />);
        const alice = container.querySelectorAll('[data-testimonial-id="a"]');
        const bob = container.querySelectorAll('[data-testimonial-id="b"]');
        expect(alice.length).toBe(2);
        expect(bob.length).toBe(2);
    });

    it('shows empty hint when items array is empty', () => {
        render(<DefaultTestimonialsBlock data={{ variant: 'single', items: [] }} />);
        expect(screen.getByText(/no testimonials/i)).toBeInTheDocument();
    });

    it('single variant only uses items[0] even if more are stored', () => {
        const data: TestimonialsBlockData = {
            variant: 'single',
            items: [
                { id: 'a', personName: 'Alice', content: 'First' },
                { id: 'b', personName: 'Bob', content: 'Second' },
            ],
        };
        render(<DefaultTestimonialsBlock data={data} />);
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.queryByText('Second')).not.toBeInTheDocument();
    });
});

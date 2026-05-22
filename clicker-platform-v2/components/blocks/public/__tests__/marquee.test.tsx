import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DefaultMarqueeBlock } from '../DefaultMarqueeBlock';
import { DEFAULT_MARQUEE_DATA, MarqueeBlockData } from '@/components/blocks/marquee/types';

describe('DefaultMarqueeBlock', () => {
    it('shows empty-state hint when items array is empty', () => {
        const data: MarqueeBlockData = { ...DEFAULT_MARQUEE_DATA, items: [] };
        render(<DefaultMarqueeBlock data={data} />);
        expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    });

    it('renders each item label twice (duplicated for seamless loop)', () => {
        render(<DefaultMarqueeBlock data={DEFAULT_MARQUEE_DATA} />);
        const matches = screen.getAllByText(/100% Online/i);
        expect(matches.length).toBe(2);
    });

    it('applies left animation by default', () => {
        const { container } = render(<DefaultMarqueeBlock data={DEFAULT_MARQUEE_DATA} />);
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track).not.toBeNull();
        expect(track.style.animationName).toBe('marquee-left');
    });

    it('applies right animation when direction=right', () => {
        const data: MarqueeBlockData = { ...DEFAULT_MARQUEE_DATA, direction: 'right' };
        const { container } = render(<DefaultMarqueeBlock data={data} />);
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track.style.animationName).toBe('marquee-right');
    });

    it('renders inline SVG icon via SafeSvgIcon when icon.kind=svg', () => {
        const data: MarqueeBlockData = {
            ...DEFAULT_MARQUEE_DATA,
            items: [{
                id: 'a',
                label: 'Custom',
                icon: { kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M1 1"/></svg>' },
            }],
        };
        const { container } = render(<DefaultMarqueeBlock data={data} />);
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('renders a wrapper with overflow:hidden so items outside the mask clip cleanly', () => {
        // jsdom silently drops mask-image / WebkitMaskImage from inline style
        // serialization, so we can't assert the mask gradient here. The mask is
        // verified visually in the smoke test (plan Task 15).
        const { container } = render(<DefaultMarqueeBlock data={DEFAULT_MARQUEE_DATA} />);
        const wrapper = container.querySelector('.marquee-wrapper') as HTMLElement;
        expect(wrapper).not.toBeNull();
        expect(wrapper.getAttribute('style') || '').toContain('overflow: hidden');
    });
});

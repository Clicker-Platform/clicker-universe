// components/blocks/shared/__tests__/MarqueeTrack.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarqueeTrack } from '../MarqueeTrack';

describe('MarqueeTrack', () => {
    it('renders children twice (doubled for seamless loop)', () => {
        const { container } = render(
            <MarqueeTrack direction="left" speed="normal" pauseOnHover gap="normal">
                <span data-testid="item">A</span>
            </MarqueeTrack>
        );
        const items = container.querySelectorAll('[data-testid="item"]');
        expect(items.length).toBe(2);
    });

    it('applies left animation by default', () => {
        const { container } = render(
            <MarqueeTrack direction="left" speed="normal" pauseOnHover gap="normal">
                <span>X</span>
            </MarqueeTrack>
        );
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track.style.animationName).toBe('marquee-left');
    });

    it('applies right animation when direction=right', () => {
        const { container } = render(
            <MarqueeTrack direction="right" speed="normal" pauseOnHover gap="normal">
                <span>X</span>
            </MarqueeTrack>
        );
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track.style.animationName).toBe('marquee-right');
    });

    it('maps speed to duration seconds', () => {
        const { container } = render(
            <MarqueeTrack direction="left" speed="fast" pauseOnHover gap="normal">
                <span>X</span>
            </MarqueeTrack>
        );
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track.style.animationDuration).toBe('18s');
    });

    it('adds marquee-pause-on-hover class when pauseOnHover=true', () => {
        const { container } = render(
            <MarqueeTrack direction="left" speed="normal" pauseOnHover gap="normal">
                <span>X</span>
            </MarqueeTrack>
        );
        expect(container.firstChild).toHaveClass('marquee-pause-on-hover');
    });

    it('omits marquee-pause-on-hover class when pauseOnHover=false', () => {
        const { container } = render(
            <MarqueeTrack direction="left" speed="normal" pauseOnHover={false} gap="normal">
                <span>X</span>
            </MarqueeTrack>
        );
        expect(container.firstChild).not.toHaveClass('marquee-pause-on-hover');
    });
});

import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DefaultFeatureCardsBlock } from '../DefaultFeatureCardsBlock';
import type { FeatureCardsData } from '@/components/blocks/feature-cards/types';

vi.mock('@/components/TemplateProvider', () => ({
    useTemplate: () => ({ theme: { cardStyle: 'clean' } }),
}));

vi.mock('@/components/DeviceViewContext', () => ({
    useDeviceView: () => 'responsive',
    dv: (_view: string, mobile: string, desktop: string) => `${mobile} ${desktop}`,
}));

vi.mock('../MediaView', () => ({
    MediaView: ({ media }: any) =>
        media?.src ? <div data-testid="media-view" data-src={media.src} /> : null,
}));

const BASE_DATA: FeatureCardsData = {
    columns: 3,
    cards: [],
};

function makeCard(overrides: Partial<any> = {}) {
    return { id: 'card-1', headline: 'Test Headline', ...overrides };
}

describe('Suite 2 — DefaultFeatureCardsBlock', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('2.1 — renders nothing when data is null', () => {
        const { container } = render(<DefaultFeatureCardsBlock data={null as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('2.2 — renders nothing when cards array is empty (no title)', () => {
        const { container } = render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [] }} />);
        expect(container.querySelector('[class*="grid"]')).toBeNull();
    });

    it('2.6 — renders headline for each card', () => {
        const cards = [
            { id: '1', headline: 'First' },
            { id: '2', headline: 'Second' },
            { id: '3', headline: 'Third' },
        ];
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards }} />);
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('2.7 — renders label when provided', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ label: 'CATEGORY' })] }} />);
        expect(screen.getByText('CATEGORY')).toBeInTheDocument();
    });

    it('2.8 — does not render label element when label is absent', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ label: undefined })] }} />);
        expect(screen.queryByText(/category/i)).toBeNull();
    });

    it('2.9 — renders body text when provided', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ body: 'Body copy here.' })] }} />);
        expect(screen.getByText('Body copy here.')).toBeInTheDocument();
    });

    it('2.10 — renders tags as pill chips', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ tags: ['Design', 'Strategy'] })] }} />);
        expect(screen.getByText('Design')).toBeInTheDocument();
        expect(screen.getByText('Strategy')).toBeInTheDocument();
    });

    it('2.11 — does not render tags section when tags array is empty', () => {
        const { container } = render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ tags: [] })] }} />);
        expect(container.querySelectorAll('.rounded-full').length).toBe(0);
    });

    it('2.12 — renders MediaView when card has media.src', () => {
        const card = makeCard({ media: { type: 'image', src: 'https://example.com/img.jpg' } });
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [card] }} />);
        expect(screen.getByTestId('media-view')).toBeInTheDocument();
        expect(screen.getByTestId('media-view').getAttribute('data-src')).toBe('https://example.com/img.jpg');
    });

    it('2.13 — does not render MediaView when card has no media.src', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ media: { type: 'image', src: '' } })] }} />);
        expect(screen.queryByTestId('media-view')).toBeNull();
    });

    it('2.14 — applies inline backgroundColor when card.bgColor is set', () => {
        const { container } = render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ bgColor: '#6366f1' })] }} />);
        const card = container.querySelector('[style*="background-color"]');
        expect(card).not.toBeNull();
        expect(card!.getAttribute('style')).toMatch(/background-color:\s*rgb\(99,\s*102,\s*241\)|#6366f1/i);
    });

    it('2.15 — renders correct number of cards', () => {
        const cards = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, headline: `Card ${i}` }));
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards }} />);
        expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(5);
    });
});

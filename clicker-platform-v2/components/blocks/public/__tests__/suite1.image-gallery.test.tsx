import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DefaultImageGalleryBlock } from '../DefaultImageGalleryBlock';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/components/TemplateProvider', () => ({
    useTemplate: () => ({ theme: { cardStyle: 'bold' } }),
}));

vi.mock('@/components/DeviceViewContext', () => ({
    useDeviceView: () => 'desktop',
    dv: (_view: string, mobile: string, desktop: string) => `${mobile} ${desktop}`,
}));

vi.mock('next/image', () => ({
    default: ({ src, alt, priority, fill, sizes, quality, className, placeholder, blurDataURL, ...rest }: { src: string; alt: string; priority?: boolean; fill?: boolean; sizes?: string; quality?: number; className?: string; placeholder?: string; blurDataURL?: string; [key: string]: unknown }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt}
            data-priority={priority ? 'true' : undefined}
            data-fill={fill ? 'true' : undefined}
            data-sizes={sizes}
            data-quality={quality}
            data-placeholder={placeholder}
            data-blur={blurDataURL ? 'true' : undefined}
            className={className}
            {...rest}
        />
    ),
}));

vi.mock('@/components/common/FullScreenGallery', () => ({
    FullScreenGallery: ({ isOpen, images, initialIndex, onClose }: { isOpen: boolean; images: unknown[]; initialIndex: number; onClose: () => void }) =>
        isOpen ? (
            <div data-testid="fullscreen-gallery" data-index={initialIndex}>
                <span data-testid="gallery-count">{images.length}</span>
                <button data-testid="gallery-close" onClick={onClose}>
                    Close
                </button>
            </div>
        ) : null,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMG_A = 'https://storage.googleapis.com/site/a.jpg';
const IMG_B = 'https://storage.googleapis.com/site/b.jpg';
const IMG_C = 'https://storage.googleapis.com/site/c.jpg';

function renderGallery(data: { images?: string[]; coverImage?: string }) {
    return render(<DefaultImageGalleryBlock data={data} />);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Suite 1 — DefaultImageGalleryBlock', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Rendering ─────────────────────────────────────────────────────────────

    it('Scenario 1.1 — renders nothing when no images and no coverImage', () => {
        const { container } = renderGallery({ images: [] });
        expect(container.firstChild).toBeNull();
    });

    it('Scenario 1.2 — renders nothing when images array contains only empty strings', () => {
        const { container } = renderGallery({ images: ['', '  ', ''] });
        expect(container.firstChild).toBeNull();
    });

    it('Scenario 1.3 — renders the cover image when images are provided', () => {
        renderGallery({ images: [IMG_A, IMG_B] });
        const coverImg = screen.getAllByRole('img').find(
            img => img.getAttribute('alt') === 'Gallery Cover'
        );
        expect(coverImg).toBeTruthy();
        expect(coverImg!.getAttribute('src')).toBe(IMG_A);
    });

    it('Scenario 1.4 — uses explicit coverImage instead of first image', () => {
        renderGallery({ images: [IMG_A, IMG_B, IMG_C], coverImage: IMG_B });
        const coverImg = screen.getAllByRole('img').find(
            img => img.getAttribute('alt') === 'Gallery Cover'
        );
        expect(coverImg!.getAttribute('src')).toBe(IMG_B);
    });

    it('Scenario 1.5 — shows photo count badge with correct number', () => {
        renderGallery({ images: [IMG_A, IMG_B, IMG_C] });
        expect(screen.getAllByText('3 Photos').length).toBeGreaterThan(0);
    });

    it('Scenario 1.6 — renders nothing if images array is empty, even with coverImage', () => {
        const { container } = renderGallery({ coverImage: IMG_A });
        expect(container.firstChild).toBeNull();
    });

    // ── Priority / Performance attributes ─────────────────────────────────────

    it('Scenario 1.7 — main cover image has priority=true (LCP)', () => {
        renderGallery({ images: [IMG_A, IMG_B] });
        const coverImg = screen.getAllByRole('img').find(
            img => img.getAttribute('alt') === 'Gallery Cover'
        );
        expect(coverImg!.getAttribute('data-priority')).toBe('true');
    });

    it('Scenario 1.10 — cover image has correct sizes for responsive layout', () => {
        renderGallery({ images: [IMG_A] });
        const coverImg = screen.getAllByRole('img').find(
            img => img.getAttribute('alt') === 'Gallery Cover'
        );
        expect(coverImg!.getAttribute('data-sizes')).toBe(
            '(max-width: 768px) 100vw, 240px'
        );
    });

    // tests 1.11, 1.12, 1.13 removed because blur decorative image and multiple blur placeholders are no longer present

    // ── Gallery open / close ───────────────────────────────────────────────────

    it('Scenario 1.14 — FullScreenGallery is closed initially', () => {
        renderGallery({ images: [IMG_A, IMG_B] });
        expect(screen.queryByTestId('fullscreen-gallery')).toBeNull();
    });

    it('Scenario 1.15 — clicking the cover opens the gallery', () => {
        renderGallery({ images: [IMG_A, IMG_B] });
        const trigger = document.querySelector('[class*="cursor-pointer"]') as HTMLElement;
        fireEvent.click(trigger);
        expect(screen.getByTestId('fullscreen-gallery')).toBeInTheDocument();
    });

    it('Scenario 1.16 — gallery receives correct image count', () => {
        renderGallery({ images: [IMG_A, IMG_B, IMG_C] });
        const trigger = document.querySelector('[class*="cursor-pointer"]') as HTMLElement;
        fireEvent.click(trigger);
        expect(screen.getByTestId('gallery-count').textContent).toBe('3');
    });

    it('Scenario 1.17 — gallery opens at correct index when coverImage matches an image', () => {
        renderGallery({ images: [IMG_A, IMG_B, IMG_C], coverImage: IMG_B });
        const trigger = document.querySelector('[class*="cursor-pointer"]') as HTMLElement;
        fireEvent.click(trigger);
        expect(screen.getByTestId('fullscreen-gallery').getAttribute('data-index')).toBe('1');
    });

    it('Scenario 1.18 — gallery opens at index 0 when coverImage is not in images array', () => {
        // coverImage is separate from images[] — indexOf returns -1 → fallback 0
        renderGallery({ images: [IMG_A, IMG_B], coverImage: IMG_C });
        const trigger = document.querySelector('[class*="cursor-pointer"]') as HTMLElement;
        fireEvent.click(trigger);
        expect(screen.getByTestId('fullscreen-gallery').getAttribute('data-index')).toBe('0');
    });

    it('Scenario 1.19 — clicking Close in gallery hides it', async () => {
        renderGallery({ images: [IMG_A, IMG_B] });
        const trigger = document.querySelector('[class*="cursor-pointer"]') as HTMLElement;
        fireEvent.click(trigger);
        fireEvent.click(screen.getByTestId('gallery-close'));
        await waitFor(() =>
            expect(screen.queryByTestId('fullscreen-gallery')).toBeNull()
        );
    });

    // ── Edge cases ────────────────────────────────────────────────────────────

    it('Scenario 1.20 — filters out blank strings from images array', () => {
        renderGallery({ images: [IMG_A, '', '  ', IMG_B] });
        // Only 2 valid images → badge shows 2, but it might render twice (mobile and desktop)
        expect(screen.getAllByText('2 Photos').length).toBeGreaterThan(0);
    });

    it('Scenario 1.21 — empty coverImage string falls back to first valid image', () => {
        renderGallery({ images: [IMG_A], coverImage: '' });
        const coverImg = screen.getAllByRole('img').find(
            img => img.getAttribute('alt') === 'Gallery Cover'
        );
        expect(coverImg!.getAttribute('src')).toBe(IMG_A);
    });

    it('Scenario 1.22 — whitespace-only coverImage treated as absent', () => {
        renderGallery({ images: [IMG_A], coverImage: '   ' });
        const coverImg = screen.getAllByRole('img').find(
            img => img.getAttribute('alt') === 'Gallery Cover'
        );
        expect(coverImg!.getAttribute('src')).toBe(IMG_A);
    });

    it('Scenario 1.23 — single image renders without error', () => {
        const { container } = renderGallery({ images: [IMG_A] });
        expect(container.firstChild).not.toBeNull();
        expect(screen.getAllByText('1 Photos').length).toBeGreaterThan(0);
    });

});

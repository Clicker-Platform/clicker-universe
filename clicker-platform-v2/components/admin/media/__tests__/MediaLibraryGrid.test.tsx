import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaLibraryGrid } from '../MediaLibraryGrid';
import type { MediaItem } from '@/lib/media/types';

vi.mock('firebase/firestore', () => ({
    Timestamp: { now: () => ({ toMillis: () => 0 }) },
}));

function mkItem(over: Partial<MediaItem>): MediaItem {
    return {
        id: 'i', url: 'https://x/i', storagePath: 'p', fileName: 'i.png',
        mimeType: 'image/png', sizeBytes: 0, folder: 'Uncategorized', tags: [],
        uploadedAt: ({ toMillis: () => 0 } as any),
        uploadedBy: 'u',
        ...over,
    };
}

describe('MediaLibraryGrid', () => {
    it('renders items and calls onSelect when a card is clicked', () => {
        const onSelect = vi.fn();
        const items = [mkItem({ id: 'a', fileName: 'a.png' }), mkItem({ id: 'b', fileName: 'b.png' })];
        render(<MediaLibraryGrid items={items} onSelect={onSelect} />);
        const btn = screen.getAllByRole('button').find(b => b.querySelector('img')?.getAttribute('alt') === 'a.png');
        fireEvent.click(btn!);
        expect(onSelect).toHaveBeenCalledWith(items[0]);
    });

    it('filters by search input', () => {
        const items = [mkItem({ id: 'a', fileName: 'hero.png' }), mkItem({ id: 'b', fileName: 'logo.png' })];
        render(<MediaLibraryGrid items={items} onSelect={() => {}} />);
        fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'hero' } });
        expect(screen.queryByAltText('logo.png')).toBeNull();
        expect(screen.getByAltText('hero.png')).toBeTruthy();
    });
});

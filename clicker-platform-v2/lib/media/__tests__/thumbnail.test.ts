import { describe, it, expect } from 'vitest';
import { getDisplayThumbnail } from '../thumbnail';
import type { MediaItem } from '../types';
import { Timestamp } from 'firebase/firestore';

function makeItem(overrides: Partial<MediaItem>): MediaItem {
    return {
        id: 'm1',
        url: 'https://example/full.webp',
        storagePath: 'sites/s/media/full.webp',
        fileName: 'a.webp',
        mimeType: 'image/webp',
        sizeBytes: 1000,
        folder: 'Uncategorized',
        tags: [],
        uploadedAt: Timestamp.now(),
        uploadedBy: 'u1',
        ...overrides,
    };
}

describe('getDisplayThumbnail', () => {
    it('returns thumbnailUrl when present', () => {
        const item = makeItem({ thumbnailUrl: 'https://example/thumb.webp' });
        expect(getDisplayThumbnail(item)).toBe('https://example/thumb.webp');
    });

    it('falls back to url when thumbnailUrl is absent', () => {
        const item = makeItem({});
        expect(getDisplayThumbnail(item)).toBe('https://example/full.webp');
    });

    it('falls back to url when thumbnailUrl is empty string', () => {
        const item = makeItem({ thumbnailUrl: '' });
        expect(getDisplayThumbnail(item)).toBe('https://example/full.webp');
    });
});

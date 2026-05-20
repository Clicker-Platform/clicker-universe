import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom doesn't load images — stub URL.createObjectURL and Image so readImageDimensions
// resolves immediately with null instead of hanging until the 5 s test timeout.
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock'), writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(_: string) { this.onerror?.(); }
}
vi.stubGlobal('Image', MockImage);

vi.mock('@/lib/upload', () => ({
    uploadToStorage: vi.fn(),
}));
vi.mock('@/lib/firebase', () => ({
    db: {},
    storage: {},
}));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db, ..._segs) => ({ _segs })),
    doc: vi.fn(() => ({ id: 'mock-id-123' })),
    setDoc: vi.fn(async () => undefined),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    query: vi.fn((..._a) => _a),
    where: vi.fn((..._a) => _a),
    orderBy: vi.fn((..._a) => _a),
    deleteDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
    serverTimestamp: vi.fn(() => 'mock-ts'),
    Timestamp: { now: () => 'mock-ts' },
}));

import { registerMedia } from '../library';
import { uploadToStorage } from '@/lib/upload';
import { setDoc } from 'firebase/firestore';

describe('registerMedia', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (uploadToStorage as any).mockResolvedValue('https://storage.example/sites/s1/media/abc.webp');
    });

    it('uploads to Storage and writes a Firestore record with defaults', async () => {
        const file = new File([new Uint8Array([1, 2, 3])], 'hero.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 12345 });

        const item = await registerMedia({
            siteId: 's1',
            file,
            uploadedBy: 'user-1',
        });

        expect(uploadToStorage).toHaveBeenCalledWith(expect.objectContaining({
            file,
            folder: 'media',
            siteId: 's1',
        }));
        expect(setDoc).toHaveBeenCalledTimes(1);
        expect(item.url).toBe('https://storage.example/sites/s1/media/abc.webp');
        expect(item.folder).toBe('Uncategorized');
        expect(item.tags).toEqual([]);
        expect(item.fileName).toBe('hero.png');
        expect(item.uploadedBy).toBe('user-1');
    });

    it('applies provided folder and tags', async () => {
        const file = new File([new Uint8Array([1])], 'h.png', { type: 'image/png' });
        const item = await registerMedia({
            siteId: 's1',
            file,
            folder: 'heroes',
            tags: ['hero', 'banner'],
            uploadedBy: 'user-1',
        });

        expect(item.folder).toBe('heroes');
        expect(item.tags).toEqual(['hero', 'banner']);
    });
});

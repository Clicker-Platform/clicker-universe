import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom doesn't load images — stub URL.createObjectURL and Image so readImageDimensions
// resolves immediately instead of hanging until the 5 s test timeout.
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock'), writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    deleteObject: vi.fn(async () => undefined),
}));

type MockImageBehavior = { kind: 'error' } | { kind: 'load'; width: number; height: number };
let mockImageBehavior: MockImageBehavior = { kind: 'error' };

class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(_: string) {
        if (mockImageBehavior.kind === 'load') {
            this.naturalWidth = mockImageBehavior.width;
            this.naturalHeight = mockImageBehavior.height;
            this.onload?.();
        } else {
            this.onerror?.();
        }
    }
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

import { registerMedia, listMedia, updateMedia, deleteMedia, MediaInUseError } from '../library';
import { uploadToStorage } from '@/lib/upload';
import { setDoc, getDocs, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { deleteObject } from 'firebase/storage';

describe('registerMedia', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockImageBehavior = { kind: 'error' };
        (uploadToStorage as any).mockResolvedValue({ url: 'https://storage.example/sites/s1/media/abc.webp', contentType: 'image/webp' });
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
        expect(item.mimeType).toBe('image/webp');
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

    it('records width/height when image loads successfully', async () => {
        mockImageBehavior = { kind: 'load', width: 1024, height: 768 };
        const file = new File([new Uint8Array([1])], 'h.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 1 });
        const item = await registerMedia({ siteId: 's1', file, uploadedBy: 'user-1' });
        expect(item.width).toBe(1024);
        expect(item.height).toBe(768);
        mockImageBehavior = { kind: 'error' };  // reset
    });
});

describe('listMedia', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns items ordered by uploadedAt desc', async () => {
        (getDocs as any).mockResolvedValue({
            docs: [
                { id: 'b', data: () => ({ id: 'b', fileName: 'b.png', folder: 'Uncategorized', tags: [] }) },
                { id: 'a', data: () => ({ id: 'a', fileName: 'a.png', folder: 'heroes', tags: ['hero'] }) },
            ],
        });
        const items = await listMedia({ siteId: 's1' });
        expect(items.map(i => i.id)).toEqual(['b', 'a']);
    });

    it('filters by folder client-side when folder provided', async () => {
        (getDocs as any).mockResolvedValue({
            docs: [
                { id: 'a', data: () => ({ id: 'a', folder: 'heroes', tags: [], fileName: 'a' }) },
                { id: 'b', data: () => ({ id: 'b', folder: 'Uncategorized', tags: [], fileName: 'b' }) },
            ],
        });
        const items = await listMedia({ siteId: 's1', folder: 'heroes' });
        expect(items.map(i => i.id)).toEqual(['a']);
    });

    it('filters by tag', async () => {
        (getDocs as any).mockResolvedValue({
            docs: [
                { id: 'a', data: () => ({ id: 'a', folder: 'f', tags: ['hero'], fileName: 'a' }) },
                { id: 'b', data: () => ({ id: 'b', folder: 'f', tags: ['team'], fileName: 'b' }) },
            ],
        });
        const items = await listMedia({ siteId: 's1', tag: 'hero' });
        expect(items.map(i => i.id)).toEqual(['a']);
    });

    it('filters by case-insensitive filename substring', async () => {
        (getDocs as any).mockResolvedValue({
            docs: [
                { id: 'a', data: () => ({ id: 'a', folder: 'f', tags: [], fileName: 'Hero-2024.png' }) },
                { id: 'b', data: () => ({ id: 'b', folder: 'f', tags: [], fileName: 'logo.png' }) },
            ],
        });
        const items = await listMedia({ siteId: 's1', search: 'hero' });
        expect(items.map(i => i.id)).toEqual(['a']);
    });
});

describe('updateMedia', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls updateDoc with the given patch', async () => {
        await updateMedia('s1', 'item-1', { folder: 'new', tags: ['a'] });
        expect(updateDoc).toHaveBeenCalledTimes(1);
        const args = (updateDoc as any).mock.calls[0];
        expect(args[1]).toEqual({ folder: 'new', tags: ['a'] });
    });
});

describe('deleteMedia', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mediaItemSnap = {
        exists: () => true,
        data: () => ({
            id: 'item-1',
            url: 'https://example/url',
            storagePath: 'sites/s1/media/file.webp',
        }),
    };
    const notExistsSnap = { exists: () => false };

    it('deletes Firestore doc and Storage object when no usages', async () => {
        // getDoc: media item first, then business doc (not-exists)
        (getDoc as any)
            .mockResolvedValueOnce(mediaItemSnap)
            .mockResolvedValueOnce(notExistsSnap);
        (getDocs as any).mockResolvedValue({ docs: [] });

        await deleteMedia('s1', 'item-1');
        expect(deleteDoc).toHaveBeenCalledTimes(1);
        expect(deleteObject).toHaveBeenCalledTimes(1);
    });

    it('throws MediaInUseError when usages found and force is not set', async () => {
        (getDoc as any)
            .mockResolvedValueOnce(mediaItemSnap)
            .mockResolvedValueOnce(notExistsSnap); // business doc
        (getDocs as any)
            .mockResolvedValueOnce({
                docs: [{ id: 'home', data: () => ({ name: 'Home', blocks: [{ src: 'https://example/url' }] }) }],
            })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] });

        await expect(deleteMedia('s1', 'item-1')).rejects.toBeInstanceOf(MediaInUseError);
        expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('force-deletes despite usages when force=true', async () => {
        (getDoc as any).mockResolvedValueOnce(mediaItemSnap);
        // force=true skips findUsages entirely, no further getDoc calls needed

        await deleteMedia('s1', 'item-1', { force: true });
        expect(deleteDoc).toHaveBeenCalledTimes(1);
        expect(deleteObject).toHaveBeenCalledTimes(1);
    });
});

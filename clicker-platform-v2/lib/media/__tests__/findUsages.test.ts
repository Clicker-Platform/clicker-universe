import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db, ..._s) => ({ _s })),
    doc: vi.fn((_db, ..._s) => ({ _s })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    where: vi.fn((..._a) => _a),
    deleteDoc: vi.fn(async () => undefined),
}));

import { findUsages } from '../library';
import { getDocs, getDoc } from 'firebase/firestore';

describe('findUsages', () => {
    beforeEach(() => vi.clearAllMocks());

    const url = 'https://storage.example/o/sites%2Fs1%2Fmedia%2Fhero.webp';

    function mockCollection(docs: { id: string; data: any }[]) {
        return { docs: docs.map(d => ({ id: d.id, data: () => d.data })) };
    }

    it('finds URL inside page blocks JSON', async () => {
        (getDocs as any)
            // pages
            .mockResolvedValueOnce(mockCollection([
                { id: 'home', data: { name: 'Home', blocks: [{ type: 'hero', props: { src: url } }] } },
                { id: 'about', data: { name: 'About', blocks: [] } },
            ]))
            // links
            .mockResolvedValueOnce(mockCollection([]))
            // forms
            .mockResolvedValueOnce(mockCollection([]));
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([
            expect.objectContaining({ type: 'page', id: 'home', label: 'Page: Home' }),
        ]);
    });

    it('finds URL inside link items', async () => {
        (getDocs as any)
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([
                { id: 'link-1', data: { title: 'Instagram', icon: url } },
            ]))
            .mockResolvedValueOnce(mockCollection([]));
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([
            expect.objectContaining({ type: 'link', id: 'link-1', label: 'Link: Instagram' }),
        ]);
    });

    it('finds URL inside form schema JSON', async () => {
        (getDocs as any)
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([
                { id: 'contact', data: { name: 'Contact Us', schema: { background: url } } },
            ]));
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([
            expect.objectContaining({ type: 'form', id: 'contact', label: 'Form: Contact Us' }),
        ]);
    });

    it('finds URL in business profile doc', async () => {
        (getDocs as any)
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([]));
        (getDoc as any).mockResolvedValue({
            exists: () => true,
            id: 'business',
            data: () => ({ logo: url, name: 'Acme' }),
        });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([
            expect.objectContaining({ type: 'business', label: 'Business profile' }),
        ]);
    });

    it('returns empty array when URL is not referenced anywhere', async () => {
        (getDocs as any)
            .mockResolvedValueOnce(mockCollection([{ id: 'p', data: { name: 'P', blocks: [{ type: 'text' }] } }]))
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([]));
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([]);
    });
});

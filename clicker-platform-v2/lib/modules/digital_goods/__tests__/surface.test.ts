import { describe, it, expect, vi } from 'vitest';

const { getDocsMock } = vi.hoisted(() => ({ getDocsMock: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), limit: vi.fn(), orderBy: vi.fn(),
  getDocs: (...a: unknown[]) => getDocsMock(...a),
  doc: vi.fn(), getDoc: vi.fn(),
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { libraryHasData } from '../surface';

describe('libraryHasData', () => {
  it('true when entries exist', async () => {
    getDocsMock.mockResolvedValue({ empty: false });
    expect(await libraryHasData({ siteId: 's1', uid: 'u1' })).toBe(true);
  });
  it('false when none', async () => {
    getDocsMock.mockResolvedValue({ empty: true });
    expect(await libraryHasData({ siteId: 's1', uid: 'u1' })).toBe(false);
  });
});

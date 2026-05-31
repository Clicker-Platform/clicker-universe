import { describe, it, expect, vi, beforeEach } from 'vitest';

const collectionMock = vi.fn();
const whereMock = vi.fn();
const limitMock = vi.fn();
const getMock = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (...a: unknown[]) => { collectionMock(...a); return { where: whereChain }; },
  },
}));
function whereChain(...a: unknown[]) { whereMock(...a); return { limit: limitChain }; }
function limitChain(...a: unknown[]) { limitMock(...a); return { get: getMock }; }

import { libraryHasDataAdmin } from '../surface-admin';

beforeEach(() => { collectionMock.mockReset(); whereMock.mockReset(); limitMock.mockReset(); getMock.mockReset(); });

describe('libraryHasDataAdmin', () => {
  it('queries the library collection by buyerId == uid', async () => {
    getMock.mockResolvedValue({ empty: true });
    await libraryHasDataAdmin('s1', 'u1');
    expect(collectionMock).toHaveBeenCalledWith('sites/s1/modules/digital_goods/library');
    expect(whereMock).toHaveBeenCalledWith('buyerId', '==', 'u1');
    expect(limitMock).toHaveBeenCalledWith(1);
  });
  it('true when an entry exists', async () => {
    getMock.mockResolvedValue({ empty: false });
    expect(await libraryHasDataAdmin('s1', 'u1')).toBe(true);
  });
  it('false when none', async () => {
    getMock.mockResolvedValue({ empty: true });
    expect(await libraryHasDataAdmin('s1', 'u1')).toBe(false);
  });
});

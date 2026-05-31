import { describe, it, expect, vi, beforeEach } from 'vitest';

const collectionMock = vi.fn();
const whereMock = vi.fn();
const limitMock = vi.fn();
const orderByMock = vi.fn();
const getMock = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (...a: unknown[]) => { collectionMock(...a); return { where: whereChain }; },
  },
}));
// Query builder is immutable-chainable: every link exposes the full set of next
// links so callers can use limit() (hasData) or orderBy() (list) interchangeably.
function whereChain(...a: unknown[]) { whereMock(...a); return chainNode(); }
function chainNode() {
  return {
    limit: (...a: unknown[]) => { limitMock(...a); return { get: getMock }; },
    orderBy: (...a: unknown[]) => { orderByMock(...a); return { get: getMock }; },
    get: getMock,
  };
}

import { libraryHasDataAdmin, listLibraryForAccountAdmin } from '../surface-admin';

beforeEach(() => {
  collectionMock.mockReset(); whereMock.mockReset(); limitMock.mockReset();
  orderByMock.mockReset(); getMock.mockReset();
});

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

describe('listLibraryForAccountAdmin', () => {
  it('queries library by buyerId == uid, ordered by purchasedAt desc', async () => {
    getMock.mockResolvedValue({ docs: [] });
    await listLibraryForAccountAdmin('s1', 'u1');
    expect(collectionMock).toHaveBeenCalledWith('sites/s1/modules/digital_goods/library');
    expect(whereMock).toHaveBeenCalledWith('buyerId', '==', 'u1');
    expect(orderByMock).toHaveBeenCalledWith('purchasedAt', 'desc');
  });
  it('maps docs to entries with id', async () => {
    getMock.mockResolvedValue({
      docs: [
        { id: 'e1', data: () => ({ buyerId: 'u1', productId: 'p1' }) },
        { id: 'e2', data: () => ({ buyerId: 'u1', productId: 'p2' }) },
      ],
    });
    const rows = await listLibraryForAccountAdmin('s1', 'u1');
    expect(rows).toEqual([
      { id: 'e1', buyerId: 'u1', productId: 'p1' },
      { id: 'e2', buyerId: 'u1', productId: 'p2' },
    ]);
  });
  it('returns [] when the buyer has no entries', async () => {
    getMock.mockResolvedValue({ docs: [] });
    expect(await listLibraryForAccountAdmin('s1', 'u1')).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const collectionMock = vi.fn();
const orderByMock = vi.fn();
const getMock = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (...a: unknown[]) => { collectionMock(...a); return { orderBy: (...b: unknown[]) => { orderByMock(...b); return { get: getMock }; } }; },
  },
}));

import { listAccounts } from '../admin-api';

beforeEach(() => { collectionMock.mockReset(); orderByMock.mockReset(); getMock.mockReset(); });

describe('listAccounts', () => {
  it('maps docs to Account objects with uid from doc id', async () => {
    getMock.mockResolvedValue({ docs: [
      { id: 'u1', data: () => ({ email: 'a@b.com', status: 'active', createdVia: 'purchase' }) },
      { id: 'u2', data: () => ({ email: 'c@d.com', status: 'pending', createdVia: 'register' }) },
    ] });
    const r = await listAccounts('s1');
    expect(collectionMock).toHaveBeenCalledWith('sites/s1/accounts');
    expect(orderByMock).toHaveBeenCalledWith('createdAt', 'desc');
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual(expect.objectContaining({ uid: 'u1', email: 'a@b.com', status: 'active', createdVia: 'purchase' }));
    expect(r[1].uid).toBe('u2');
  });

  it('returns empty array when no accounts', async () => {
    getMock.mockResolvedValue({ docs: [] });
    expect(await listAccounts('s1')).toEqual([]);
  });
});

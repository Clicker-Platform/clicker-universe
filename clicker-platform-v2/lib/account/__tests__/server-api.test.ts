import { describe, it, expect, vi, beforeEach } from 'vitest';

const docMock = vi.fn();
const getMock = vi.fn();
const setMock = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { doc: (...a: unknown[]) => { docMock(...a); return { get: getMock, set: setMock }; } },
  Timestamp: { now: () => ({ _now: true }) },
}));

import { getAccount, ensureAccount, markAccountActive, updateAccountAccent } from '../server-api';

beforeEach(() => { docMock.mockReset(); getMock.mockReset(); setMock.mockReset(); });

describe('getAccount', () => {
  it('returns null when missing', async () => {
    getMock.mockResolvedValue({ exists: false });
    expect(await getAccount('site1', 'uid1')).toBeNull();
    expect(docMock).toHaveBeenCalledWith('sites/site1/accounts/uid1');
  });
  it('returns account when present', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ email: 'a@b.com', status: 'active' }) });
    const acc = await getAccount('site1', 'uid1');
    expect(acc?.email).toBe('a@b.com');
    expect(acc?.uid).toBe('uid1');
  });
});

describe('ensureAccount', () => {
  it('creates a pending account when absent', async () => {
    getMock.mockResolvedValue({ exists: false });
    await ensureAccount('site1', 'uid1', { email: 'a@b.com', createdVia: 'purchase' });
    expect(setMock).toHaveBeenCalledTimes(1);
    const written = setMock.mock.calls[0][0];
    expect(written.status).toBe('pending');
    expect(written.createdVia).toBe('purchase');
    expect(written.uid).toBe('uid1');
  });
  it('does not overwrite an existing account', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ email: 'a@b.com', status: 'active' }) });
    await ensureAccount('site1', 'uid1', { email: 'a@b.com', createdVia: 'purchase' });
    expect(setMock).not.toHaveBeenCalled();
  });
});

describe('markAccountActive', () => {
  it('merges status active', async () => {
    await markAccountActive('site1', 'uid1');
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      { merge: true },
    );
  });
});

describe('updateAccountAccent', () => {
  it('merges the chosen accent preset onto the account doc', async () => {
    await updateAccountAccent('site1', 'uid1', 'indigo');
    expect(docMock).toHaveBeenCalledWith('sites/site1/accounts/uid1');
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ accentPreset: 'indigo' }),
      { merge: true },
    );
  });
});

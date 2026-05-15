import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const limitMock = vi.fn();
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const collectionGroupMock = vi.fn(() => ({ where: whereMock }));

  // Promo path: collection('sites').doc('go').collection('modules').doc('promo').collection('promos').where(...).limit(...).get()
  const promoLimitGetMock = vi.fn();
  const promoWhereMock = vi.fn(() => ({ limit: () => ({ get: promoLimitGetMock }) }));
  const promosCollectionMock = vi.fn(() => ({ where: promoWhereMock }));
  const promoModuleDocMock = vi.fn(() => ({ collection: promosCollectionMock }));
  const modulesCollectionMock = vi.fn(() => ({ doc: promoModuleDocMock }));
  const goSiteDocMock = vi.fn(() => ({ collection: modulesCollectionMock }));

  // Registration path: collection('registrationRequests').doc()
  const setMock = vi.fn(async (_data: Record<string, unknown>) => undefined);
  const regDocMock = vi.fn(() => ({ id: 'reg-abc123', set: setMock }));

  // Top-level collection() router — returns different shape based on collection name
  const collectionMock = vi.fn((name: string) => {
    if (name === 'sites') return { doc: goSiteDocMock };
    return { doc: regDocMock };
  });

  const timestampNowMock = vi.fn(() => ({ __ts: 'now' }));
  return {
    limitMock,
    whereMock,
    collectionGroupMock,
    promoLimitGetMock,
    promoWhereMock,
    setMock,
    docMock: regDocMock,
    collectionMock,
    timestampNowMock,
  };
});

const { limitMock, whereMock, collectionGroupMock, promoLimitGetMock, promoWhereMock, setMock, docMock, collectionMock, timestampNowMock } = mocks;

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collectionGroup: mocks.collectionGroupMock,
    collection: mocks.collectionMock,
  },
  Timestamp: { now: mocks.timestampNowMock },
  FieldValue: {},
}));

import { validatePromoCode, createRegistrationRequest } from '../api-server';

beforeEach(() => {
  limitMock.mockReset();
  whereMock.mockClear();
  collectionGroupMock.mockClear();
  promoLimitGetMock.mockReset();
  promoWhereMock.mockClear();
  setMock.mockClear();
  docMock.mockClear();
  collectionMock.mockClear();
  timestampNowMock.mockClear();
});

describe('validatePromoCode', () => {
  it('returns invalid when code is empty', async () => {
    const r = await validatePromoCode('');
    expect(r.valid).toBe(false);
    expect(r.reason).toBeDefined();
    expect(promoWhereMock).not.toHaveBeenCalled();
  });

  it('returns invalid when no promo matches', async () => {
    promoLimitGetMock.mockResolvedValue({ empty: true, docs: [] });
    const r = await validatePromoCode('NOPE');
    expect(r.valid).toBe(false);
    expect(promoWhereMock).toHaveBeenCalledWith('code', '==', 'NOPE');
  });

  it('returns valid with name when promo matches', async () => {
    promoLimitGetMock.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ name: 'Welcome 10%', code: 'WELCOME', kind: 'percent', value: 10 }) }],
    });
    const r = await validatePromoCode('WELCOME');
    expect(r.valid).toBe(true);
    expect(r.name).toBe('Welcome 10%');
  });

  it('uppercases and trims input before query', async () => {
    promoLimitGetMock.mockResolvedValue({ empty: true, docs: [] });
    await validatePromoCode('  welcome  ');
    expect(promoWhereMock).toHaveBeenCalledWith('code', '==', 'WELCOME');
  });
});

describe('createRegistrationRequest', () => {
  const baseInput = {
    name: 'Andi',
    email: 'andi@example.com',
    phone: '081234567890',
    businessName: 'Warung Kopi',
    businessType: 'fnb' as const,
    city: 'Jakarta',
    expectedOutlets: 1,
    bundle: null,
    modules: ['byod_pos'],
    customRequest: '',
    promoCode: null,
    promoCodeValidAtSubmit: false,
    source: null,
  };

  it('writes to registrationRequests with pending status and timestamps', async () => {
    const id = await createRegistrationRequest(baseInput);
    expect(id).toBe('reg-abc123');
    expect(collectionMock).toHaveBeenCalledWith('registrationRequests');
    expect(setMock).toHaveBeenCalledTimes(1);
    const written = setMock.mock.calls[0][0];
    expect(written.status).toBe('pending');
    expect(written.createdAt).toEqual({ __ts: 'now' });
    expect(written.updatedAt).toEqual({ __ts: 'now' });
    expect(written.activatedSiteId).toBeNull();
    expect(written.activatedAt).toBeNull();
    expect(written.rejectionReason).toBeNull();
    expect(written.internalNotes).toBe('');
    expect(written.name).toBe('Andi');
    expect(written.modules).toEqual(['byod_pos']);
  });

  it('normalizes promoCode to trimmed uppercase before persisting', async () => {
    await createRegistrationRequest({ ...baseInput, promoCode: '  welcome  ' });
    const written = setMock.mock.calls[0][0];
    expect(written.promoCode).toBe('WELCOME');
  });

  it('persists null promoCode when input is null', async () => {
    await createRegistrationRequest({ ...baseInput, promoCode: null });
    const written = setMock.mock.calls[0][0];
    expect(written.promoCode).toBeNull();
  });
});

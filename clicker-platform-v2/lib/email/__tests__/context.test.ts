import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  mockGet.mockReset();
  process.env.EMAIL_SENDER_DOMAIN = 'clicker.id';
  process.env.EMAIL_SYSTEM_FROM_NAME = 'Clicker Platform';
});

describe('getEmailContext', () => {
  it('returns system defaults for null siteId', async () => {
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();
    const ctx = await getEmailContext(null);
    expect(ctx.fromName).toBe('Clicker Platform');
    expect(ctx.fromAddress).toBe('noreply@clicker.id');
    expect(ctx.brand.businessName).toBe('Clicker Platform');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('reads site doc and builds context', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        name: 'Acme Coffee',
        ownerEmail: 'owner@acme.com',
        slug: 'acme',
        logoUrl: 'https://cdn/acme-logo.png',
        primaryColor: '#ff6600',
      }),
    });
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();
    const ctx = await getEmailContext('site-1');
    expect(ctx.fromName).toBe('Acme Coffee');
    expect(ctx.fromAddress).toBe('noreply@clicker.id');
    expect(ctx.replyTo).toBe('owner@acme.com');
    expect(ctx.brand.businessName).toBe('Acme Coffee');
    expect(ctx.brand.logoUrl).toBe('https://cdn/acme-logo.png');
    expect(ctx.brand.primaryColor).toBe('#ff6600');
  });

  it('falls back to system defaults if site doc missing', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();
    const ctx = await getEmailContext('missing-site');
    expect(ctx.fromName).toBe('Clicker Platform');
  });

  it('caches result for 5 minutes', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Acme Coffee' }),
    });
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();

    await getEmailContext('site-1');
    await getEmailContext('site-1');
    expect(mockGet).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await getEmailContext('site-1');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('falls back to system on Firestore error and logs warning', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();
    const ctx = await getEmailContext('site-error');
    expect(ctx.fromName).toBe('Clicker Platform');
  });
});

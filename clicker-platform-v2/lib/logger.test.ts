import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase-admin BEFORE importing logger
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      })),
    })),
  },
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ toDate: () => d, _seconds: Math.floor(d.getTime() / 1000) })),
  },
  FieldValue: {
    increment: vi.fn((n: number) => ({ _increment: n })),
  },
}));

vi.mock('firebase-admin/firestore', () => ({}));

describe('logger', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger.error', () => {
    it('calls console.error with JSON payload containing event and level', async () => {
      const { logger } = await import('@/lib/logger');
      logger.error('test.event.failed', { siteId: 'test-site', error: 'something broke' });
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const call = consoleErrorSpy.mock.calls[0][0];
      const payload = JSON.parse(call);
      expect(payload.level).toBe('error');
      expect(payload.event).toBe('test.event.failed');
      expect(payload.siteId).toBe('test-site');
      expect(payload.meta.error).toBe('something broke');
      expect(payload.ts).toBeDefined();
    });
  });

  describe('logger.warn', () => {
    it('calls console.warn with JSON payload containing event and level', async () => {
      const { logger } = await import('@/lib/logger');
      logger.warn('test.event.skipped', { siteId: 'other-site' });
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const call = consoleWarnSpy.mock.calls[0][0];
      const payload = JSON.parse(call);
      expect(payload.level).toBe('warn');
      expect(payload.event).toBe('test.event.skipped');
    });
  });

  describe('isFirestoreCritical', () => {
    it('returns true for whitelisted events', async () => {
      const { isFirestoreCritical } = await import('@/lib/logger');
      expect(isFirestoreCritical('upload.image.failed')).toBe(true);
      expect(isFirestoreCritical('wa.send.failed')).toBe(true);
      expect(isFirestoreCritical('pos.checkout.failed')).toBe(true);
    });

    it('returns false for non-whitelisted events', async () => {
      const { isFirestoreCritical } = await import('@/lib/logger');
      expect(isFirestoreCritical('some.random.event')).toBe(false);
      expect(isFirestoreCritical('analytics.invalid.siteId')).toBe(false);
    });
  });

  describe('buildDedupeKey', () => {
    it('produces deterministic key per siteId + event + 5-minute window', async () => {
      const { buildDedupeKey } = await import('@/lib/logger');
      const key1 = buildDedupeKey('quattro', 'upload.image.failed');
      const key2 = buildDedupeKey('quattro', 'upload.image.failed');
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^quattro_upload\.image\.failed_\d+$/);
    });

    it('differs for different siteId', async () => {
      const { buildDedupeKey } = await import('@/lib/logger');
      const k1 = buildDedupeKey('siteA', 'upload.image.failed');
      const k2 = buildDedupeKey('siteB', 'upload.image.failed');
      expect(k1).not.toBe(k2);
    });

    it('sanitizes siteId containing slashes', async () => {
      const { buildDedupeKey } = await import('@/lib/logger');
      const key = buildDedupeKey('site/with/slash', 'upload.image.failed');
      expect(key).not.toContain('/');
      expect(key).toMatch(/^site_with_slash_upload\.image\.failed_\d+$/);
    });

    it('sanitizes event containing slashes', async () => {
      const { buildDedupeKey } = await import('@/lib/logger');
      const key = buildDedupeKey('platform', 'some/nested/event');
      expect(key).not.toContain('/');
      expect(key).toMatch(/^platform_some_nested_event_\d+$/);
    });
  });

  describe('formatDev', () => {
    it('returns readable string with level, event, siteId', async () => {
      const { formatDev } = await import('@/lib/logger');
      const payload = {
        level: 'error' as const,
        event: 'upload.image.failed',
        service: 'clicker-platform',
        siteId: 'quattro',
        ts: '2026-04-25T10:00:00.000Z',
        meta: { error: 'permission-denied' },
      };
      const result = formatDev(payload);
      expect(result).toBe('[ERROR] upload.image.failed | siteId: quattro | error: permission-denied');
    });

    it('includes all meta fields as key: value pairs', async () => {
      const { formatDev } = await import('@/lib/logger');
      const payload = {
        level: 'warn' as const,
        event: 'analytics.invalid.siteId',
        service: 'clicker-platform',
        siteId: 'platform',
        ts: '2026-04-25T10:00:00.000Z',
        meta: { endpoint: '/api/track', detail: 'missing' },
      };
      const result = formatDev(payload);
      expect(result).toBe('[WARN]  analytics.invalid.siteId | siteId: platform | endpoint: /api/track | detail: missing');
    });

    it('omits meta section when meta is empty', async () => {
      const { formatDev } = await import('@/lib/logger');
      const payload = {
        level: 'info' as const,
        event: 'some.event',
        service: 'clicker-platform',
        siteId: 'platform',
        ts: '2026-04-25T10:00:00.000Z',
        meta: {},
      };
      const result = formatDev(payload);
      expect(result).toBe('[INFO]  some.event | siteId: platform');
    });
  });
});

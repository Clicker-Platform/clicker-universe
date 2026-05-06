import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFetch = vi.fn();
const mockSetLog = vi.fn();
const mockGetCtx = vi.fn();

vi.stubGlobal('fetch', mockFetch);

vi.mock('../log', () => ({
  newLogDocRef: () => ({ id: 'log-id-123', set: mockSetLog }),
  writeEmailLog: async (_ref: unknown, doc: unknown) => mockSetLog(doc),
  getLogCollection: () => ({}),
}));

vi.mock('../context', () => ({
  getEmailContext: (...args: unknown[]) => mockGetCtx(...args),
}));

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
  mockSetLog.mockReset();
  mockGetCtx.mockReset();
  mockGetCtx.mockResolvedValue({
    fromName: 'Acme',
    fromAddress: 'noreply@clicker.id',
    replyTo: null,
    brand: {
      businessName: 'Acme',
      logoUrl: null,
      primaryColor: null,
      siteUrl: 'https://acme.clicker.id',
    },
  });
  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 'test-key';
});

function mockResendSuccess(id = 'resend-msg-1') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id }),
  });
}

function mockResendError(message: string, name = 'validation_error') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ message, name }),
  });
}

describe('sendEmail', () => {
  it('returns ok and writes sent log on success', async () => {
    mockResendSuccess('resend-msg-1');
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'jane@example.com',
      templateAlias: 'password-reset',
      variables: { resetLink: 'https://example.com/reset' },
      siteId: 'site-1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe('resend-msg-1');
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', resendId: 'resend-msg-1' })
    );
  });

  it('sends template.id and merged variables to Resend API', async () => {
    mockResendSuccess('r1');
    const { sendEmail } = await import('../sender');
    await sendEmail({
      to: 'jane@example.com',
      templateAlias: 'password-reset',
      variables: { resetLink: 'https://example.com/reset' },
      siteId: 'site-1',
    });
    const fetchCall = mockFetch.mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body);
    expect(body.template.id).toBe('password-reset');
    expect(body.template.variables).toMatchObject({
      resetLink: 'https://example.com/reset',
      businessName: 'Acme',
    });
    expect(body.html).toBeUndefined();
  });

  it('returns failure and writes failed log on Resend error', async () => {
    mockResendError('Rate limited', 'rate_limit');
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'jane@example.com',
      templateAlias: 'password-reset',
      variables: {},
      siteId: 'site-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Rate limited');
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: 'rate_limit' })
    );
  });

  it('blocks dev allowlist violations and tags log', async () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_DEV_ALLOWLIST = '@clicker.id';
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'random@example.com',
      templateAlias: 'password-reset',
      variables: {},
      siteId: 'site-1',
    });
    expect(result.ok).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        tags: expect.arrayContaining([{ name: 'dev_blocked', value: 'true' }]),
      })
    );
  });

  it('normalizes string to/cc/bcc into arrays in the log doc', async () => {
    mockResendSuccess('r2');
    const { sendEmail } = await import('../sender');
    await sendEmail({
      to: 'a@clicker.id',
      cc: 'b@clicker.id',
      templateAlias: 'system-alert',
      variables: {},
      siteId: null,
    });
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@clicker.id'], cc: ['b@clicker.id'] })
    );
  });

  it('passes through tags into Resend and log', async () => {
    mockResendSuccess('r3');
    const { sendEmail } = await import('../sender');
    await sendEmail({
      to: 'a@clicker.id',
      templateAlias: 'form-submission',
      variables: {},
      siteId: null,
      tags: [{ name: 'module', value: 'forms' }],
    });
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.tags).toEqual([{ name: 'module', value: 'forms' }]);
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ name: 'module', value: 'forms' }] })
    );
  });
});

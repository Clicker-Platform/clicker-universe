import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';

const mockSend = vi.fn();
const mockSetLog = vi.fn();
const mockGetCtx = vi.fn();

vi.mock('../resend-client', () => ({
  getResendClient: () => ({ emails: { send: mockSend } }),
}));

vi.mock('../log', () => ({
  newLogDocRef: () => ({ id: 'log-id-123', set: mockSetLog }),
  writeEmailLog: async (_ref: unknown, doc: unknown) => mockSetLog(doc),
  getLogCollection: () => ({}),
}));

vi.mock('../context', () => ({
  getEmailContext: (...args: unknown[]) => mockGetCtx(...args),
}));

vi.mock('../render', () => ({
  renderTemplate: async () => ({ html: '<html></html>', text: 'plain' }),
}));

beforeEach(() => {
  vi.resetModules();
  mockSend.mockReset();
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

describe('sendEmail', () => {
  it('returns ok and writes sent log on success', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'resend-msg-1' }, error: null });
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'jane@example.com',
      subject: 'Hello',
      template: createElement('div', null, 'x'),
      siteId: 'site-1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe('resend-msg-1');
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', resendId: 'resend-msg-1' })
    );
  });

  it('returns failure and writes failed log on Resend error', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit' },
    });
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'jane@example.com',
      subject: 'Hello',
      template: createElement('div', null, 'x'),
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
      subject: 'Hello',
      template: createElement('div', null, 'x'),
      siteId: 'site-1',
    });
    expect(result.ok).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        tags: expect.arrayContaining([{ name: 'dev_blocked', value: 'true' }]),
      })
    );
  });

  it('normalizes string to/cc/bcc into arrays in the log doc', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'r2' }, error: null });
    const { sendEmail } = await import('../sender');
    await sendEmail({
      to: 'a@clicker.id',
      cc: 'b@clicker.id',
      subject: 's',
      template: createElement('div', null, 'x'),
      siteId: null,
    });
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@clicker.id'], cc: ['b@clicker.id'] })
    );
  });

  it('passes through tags into Resend and log', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'r3' }, error: null });
    const { sendEmail } = await import('../sender');
    await sendEmail({
      to: 'a@clicker.id',
      subject: 's',
      template: createElement('div', null, 'x'),
      siteId: null,
      tags: [{ name: 'module', value: 'forms' }],
    });
    const sendCall = mockSend.mock.calls[0]![0];
    expect(sendCall.tags).toEqual([{ name: 'module', value: 'forms' }]);
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ name: 'module', value: 'forms' }] })
    );
  });
});

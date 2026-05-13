import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  createRegistrationRequest: vi.fn(),
  validatePromoCode: vi.fn(),
  submitLimiterCheck: vi.fn(),
  headersGet: vi.fn(),
  writeEvent: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: mocks.headersGet }),
}));

vi.mock('@/lib/email/sender', () => ({ sendEmail: mocks.sendEmail }));

vi.mock('../api-server', () => ({
  createRegistrationRequest: mocks.createRegistrationRequest,
  validatePromoCode: mocks.validatePromoCode,
}));

vi.mock('../rate-limit', () => ({
  submitLimiter: { check: mocks.submitLimiterCheck },
  validatePromoLimiter: { check: vi.fn(() => true) },
}));

vi.mock('../event-log', () => ({ writeEvent: mocks.writeEvent }));

import { submitRegistration } from '../submit-action';

const validInput = {
  name: 'Test User',
  email: 'test@gmail.com',
  phone: '+6281234567890',
  businessName: 'Test Biz',
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

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headersGet.mockReturnValue('1.2.3.4');
  mocks.submitLimiterCheck.mockReturnValue(true);
  process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@test.com';
  process.env.RESEND_TEMPLATE_REG_CONFIRMATION = 'reg-confirm';
  process.env.RESEND_TEMPLATE_REG_ADMIN_NOTIF = 'reg-notif';
});

async function flush() {
  // Allow microtasks (fire-and-forget email promise) to settle
  await new Promise((r) => setTimeout(r, 10));
}

describe('submit-action email hooks', () => {
  it('mengirim 2 email saat submit sukses (pendaftar + admin)', async () => {
    mocks.createRegistrationRequest.mockResolvedValue('reg-123');
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'email-1', logId: 'log-1' });

    const result = await submitRegistration(validInput);
    await flush();

    expect(result.ok).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);

    const calls = mocks.sendEmail.mock.calls;
    const toAddresses = calls.map((c) => c[0].to);
    expect(toAddresses).toContain('test@gmail.com');
    expect(toAddresses).toContain('admin@test.com');
  });

  it('submit tetap sukses meski email gagal kirim', async () => {
    mocks.createRegistrationRequest.mockResolvedValue('reg-123');
    mocks.sendEmail.mockRejectedValue(new Error('Resend down'));

    const result = await submitRegistration(validInput);
    await flush();

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ ok: true, id: 'reg-123' });
  });

  it('menulis email.failed event ketika email gagal', async () => {
    mocks.createRegistrationRequest.mockResolvedValue('reg-123');
    mocks.sendEmail.mockResolvedValue({ ok: false, error: 'Resend rejected', logId: 'log-1' });

    await submitRegistration(validInput);
    await flush();

    expect(mocks.writeEvent).toHaveBeenCalled();
    const evt = mocks.writeEvent.mock.calls[0][0];
    expect(evt.type).toBe('email.failed');
    expect(evt.registrationId).toBe('reg-123');
    expect(evt.payload).toMatchObject({ error: 'Resend rejected' });
  });

  it('tidak kirim notif admin kalau ADMIN_NOTIFICATION_EMAIL tidak diset', async () => {
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    mocks.createRegistrationRequest.mockResolvedValue('reg-123');
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'email-1', logId: 'log-1' });

    await submitRegistration(validInput);
    await flush();

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0].to).toBe('test@gmail.com');
  });
});

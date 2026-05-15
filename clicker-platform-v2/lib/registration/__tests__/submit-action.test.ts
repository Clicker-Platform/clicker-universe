import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRegistrationRequest: vi.fn(),
  validatePromoCode: vi.fn(),
  submitLimiterCheck: vi.fn(),
  headersGet: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: mocks.headersGet }),
}));

vi.mock('../api-server', () => ({
  createRegistrationRequest: mocks.createRegistrationRequest,
  validatePromoCode: mocks.validatePromoCode,
}));

vi.mock('../rate-limit', () => ({
  submitLimiter: { check: mocks.submitLimiterCheck },
  validatePromoLimiter: { check: vi.fn(() => true) },
}));

import { submitRegistration } from '../submit-action';

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

beforeEach(() => {
  mocks.createRegistrationRequest.mockReset();
  mocks.validatePromoCode.mockReset();
  mocks.submitLimiterCheck.mockReset();
  mocks.headersGet.mockReset();
  mocks.headersGet.mockReturnValue('1.2.3.4');
  mocks.submitLimiterCheck.mockReturnValue(true);
});

describe('submitRegistration', () => {
  it('returns ok with id on valid input', async () => {
    mocks.createRegistrationRequest.mockResolvedValue('reg-123');
    const r = await submitRegistration(baseInput);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.id).toBe('reg-123');
  });

  it('returns error on invalid input', async () => {
    const r = await submitRegistration({ ...baseInput, email: 'not-email' });
    expect(r.ok).toBe(false);
    expect(mocks.createRegistrationRequest).not.toHaveBeenCalled();
  });

  it('returns error on rate limit hit', async () => {
    mocks.submitLimiterCheck.mockReturnValue(false);
    const r = await submitRegistration(baseInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too many|rate/i);
  });

  it('revalidates promo when promoCode is set and stores correct flag', async () => {
    mocks.validatePromoCode.mockResolvedValue({ valid: true, name: 'Welcome' });
    mocks.createRegistrationRequest.mockResolvedValue('reg-1');
    await submitRegistration({ ...baseInput, promoCode: 'WELCOME', promoCodeValidAtSubmit: false });
    expect(mocks.validatePromoCode).toHaveBeenCalledWith('WELCOME');
    const written = mocks.createRegistrationRequest.mock.calls[0][0];
    expect(written.promoCodeValidAtSubmit).toBe(true);
  });

  it('skips promo revalidation when promoCode is null', async () => {
    mocks.createRegistrationRequest.mockResolvedValue('reg-2');
    await submitRegistration(baseInput);
    expect(mocks.validatePromoCode).not.toHaveBeenCalled();
  });
});

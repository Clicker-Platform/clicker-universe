import { describe, it, expect } from 'vitest';
import { registrationInputSchema } from '../schema';

const base = {
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

describe('registrationInputSchema', () => {
  it('accepts a fully valid payload', () => {
    expect(registrationInputSchema.safeParse(base).success).toBe(true);
  });

  it('rejects invalid email', () => {
    const r = registrationInputSchema.safeParse({ ...base, email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('rejects too-short business name', () => {
    const r = registrationInputSchema.safeParse({ ...base, businessName: 'A' });
    expect(r.success).toBe(false);
  });

  it('rejects unknown businessType', () => {
    const r = registrationInputSchema.safeParse({ ...base, businessType: 'flying-cars' });
    expect(r.success).toBe(false);
  });

  it('rejects expectedOutlets < 1', () => {
    const r = registrationInputSchema.safeParse({ ...base, expectedOutlets: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects non-integer expectedOutlets', () => {
    const r = registrationInputSchema.safeParse({ ...base, expectedOutlets: 1.5 });
    expect(r.success).toBe(false);
  });

  it('accepts +62, 62, and 0 phone prefixes', () => {
    expect(registrationInputSchema.safeParse({ ...base, phone: '+6281234567890' }).success).toBe(true);
    expect(registrationInputSchema.safeParse({ ...base, phone: '6281234567890' }).success).toBe(true);
    expect(registrationInputSchema.safeParse({ ...base, phone: '081234567890' }).success).toBe(true);
  });

  it('rejects malformed phone', () => {
    const r = registrationInputSchema.safeParse({ ...base, phone: '12345' });
    expect(r.success).toBe(false);
  });

  it('rejects empty intent (no modules and no customRequest)', () => {
    const r = registrationInputSchema.safeParse({ ...base, modules: [], customRequest: '   ' });
    expect(r.success).toBe(false);
  });

  it('accepts customRequest-only intent (no modules)', () => {
    const r = registrationInputSchema.safeParse({ ...base, modules: [], customRequest: 'Custom thing please' });
    expect(r.success).toBe(true);
  });
});

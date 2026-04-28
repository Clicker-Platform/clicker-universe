import { describe, it, expect } from 'vitest';
import { generateVoucherCode } from '../code-generator';

describe('generateVoucherCode', () => {
  it('produces format PREFIX-XXXX-XXXX with default prefix', () => {
    const code = generateVoucherCode('VCH');
    expect(code).toMatch(/^VCH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('respects custom prefix (uppercased, max 5 chars)', () => {
    expect(generateVoucherCode('shop')).toMatch(/^SHOP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(generateVoucherCode('verylongprefix')).toMatch(/^VERYL-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('falls back to VCH when prefix is empty', () => {
    expect(generateVoucherCode('')).toMatch(/^VCH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('avoids ambiguous chars (no 0/O/1/I/L)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVoucherCode('VCH');
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it('produces unique codes across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateVoucherCode('VCH'));
    expect(seen.size).toBe(1000);
  });
});

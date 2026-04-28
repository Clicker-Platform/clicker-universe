import { describe, it, expect } from 'vitest';
import { calculateDiscount } from '../api/discount';

describe('calculateDiscount', () => {
  it('percent: applies value, capped to subtotal', () => {
    expect(calculateDiscount({ kind: 'percent', value: 20 }, 100_000)).toBe(20_000);
    expect(calculateDiscount({ kind: 'percent', value: 200 }, 100_000)).toBe(100_000); // > 100% caps at subtotal
  });

  it('percent: respects maxDiscount cap', () => {
    expect(calculateDiscount({ kind: 'percent', value: 50, maxDiscount: 30_000 }, 100_000)).toBe(30_000);
    expect(calculateDiscount({ kind: 'percent', value: 10, maxDiscount: 30_000 }, 100_000)).toBe(10_000); // under cap
  });

  it('fixed: applies value, capped to subtotal', () => {
    expect(calculateDiscount({ kind: 'fixed', value: 50_000 }, 100_000)).toBe(50_000);
    expect(calculateDiscount({ kind: 'fixed', value: 200_000 }, 100_000)).toBe(100_000); // capped
  });

  it('returns 0 for non-positive subtotal', () => {
    expect(calculateDiscount({ kind: 'percent', value: 20 }, 0)).toBe(0);
    expect(calculateDiscount({ kind: 'fixed', value: 50_000 }, -10)).toBe(0);
  });

  it('rounds to integer (no fractional currency)', () => {
    expect(calculateDiscount({ kind: 'percent', value: 33 }, 100)).toBe(33);
    expect(calculateDiscount({ kind: 'percent', value: 33.333 }, 100)).toBe(33);
  });
});

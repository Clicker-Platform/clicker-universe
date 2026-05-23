import { describe, it, expect } from 'vitest';
import {
  USD_PER_CREDIT,
  usdToCredits,
  formatCredits,
  formatCreditsShort,
} from '@/lib/ai/credits-display';

describe('credits-display', () => {
  it('exposes the peg as 0.01', () => {
    expect(USD_PER_CREDIT).toBe(0.01);
  });

  it('converts USD to whole credits via rounding', () => {
    expect(usdToCredits(6.42)).toBe(642);
    expect(usdToCredits(0)).toBe(0);
    expect(usdToCredits(0.004)).toBe(0);    // rounds down
    expect(usdToCredits(0.005)).toBe(1);    // rounds up at .5
    expect(usdToCredits(9.999)).toBe(1000); // 999.9 → 1000
  });

  it('clamps negative balances to 0 credits', () => {
    expect(usdToCredits(-1)).toBe(0);
    expect(usdToCredits(-0.0001)).toBe(0);
  });

  it('formatCredits returns full thousand-separated string with "credits"', () => {
    expect(formatCredits(6.42)).toBe('642 credits');
    expect(formatCredits(124)).toBe('12,400 credits');
    expect(formatCredits(0)).toBe('0 credits');
  });

  it('formatCreditsShort abbreviates >= 10,000 credits with k', () => {
    expect(formatCreditsShort(6.42)).toBe('642');
    expect(formatCreditsShort(99.99)).toBe('9,999');
    expect(formatCreditsShort(100)).toBe('10k');
    expect(formatCreditsShort(124)).toBe('12.4k');
    expect(formatCreditsShort(1000)).toBe('100k');
  });
});

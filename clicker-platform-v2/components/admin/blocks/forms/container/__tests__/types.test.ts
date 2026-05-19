import { describe, it, expect } from 'vitest';
import { distributeSizes, clampSize } from '../types';

describe('distributeSizes', () => {
  it('returns equal share when count divides 12', () => {
    expect(distributeSizes(3)).toEqual([4, 4, 4]);
    expect(distributeSizes(4)).toEqual([3, 3, 3, 3]);
    expect(distributeSizes(6)).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it('distributes remainder left-to-right', () => {
    expect(distributeSizes(5)).toEqual([3, 3, 2, 2, 2]); // 12 = 3+3+2+2+2
    expect(distributeSizes(7)).toEqual([2, 2, 2, 2, 2, 1, 1]); // 12 = 2*5 + 1*2
  });

  it('returns [12] for single child', () => {
    expect(distributeSizes(1)).toEqual([12]);
  });

  it('returns [] for zero children', () => {
    expect(distributeSizes(0)).toEqual([]);
  });

  it('caps at 12 children when N > 12 (each = 1)', () => {
    expect(distributeSizes(12)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('clampSize', () => {
  it('clamps to 1–12 integer range', () => {
    expect(clampSize(0)).toBe(1);
    expect(clampSize(1)).toBe(1);
    expect(clampSize(6.7)).toBe(6);
    expect(clampSize(12)).toBe(12);
    expect(clampSize(15)).toBe(12);
  });
});

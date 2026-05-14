import { describe, it, expect } from 'vitest';
import { pickThumbnailColor } from '../PagesColumn';

describe('pickThumbnailColor', () => {
  it('returns the same color for the same id', () => {
    expect(pickThumbnailColor('abc')).toBe(pickThumbnailColor('abc'));
  });

  it('returns a string from the palette', () => {
    const result = pickThumbnailColor('hello');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles empty id', () => {
    expect(typeof pickThumbnailColor('')).toBe('string');
  });
});

import { describe, it, expect } from 'vitest';
import { pickContrastText, parseHex, relativeLuminance } from '../contrast';

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex('#ff7a1a')).toEqual({ r: 255, g: 122, b: 26 });
  });
  it('parses 3-digit hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#000')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('parses without leading #', () => {
    expect(parseHex('111111')).toEqual({ r: 17, g: 17, b: 17 });
  });
});

describe('relativeLuminance', () => {
  it('returns 1 for white', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 3);
  });
  it('returns 0 for black', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 3);
  });
});

describe('pickContrastText', () => {
  it('returns white text on dark fill', () => {
    expect(pickContrastText('#111111')).toBe('#ffffff');
    expect(pickContrastText('#000000')).toBe('#ffffff');
    expect(pickContrastText('#2563eb')).toBe('#ffffff');
  });
  it('returns black text on light fill', () => {
    expect(pickContrastText('#ffffff')).toBe('#000000');
    expect(pickContrastText('#fef3c7')).toBe('#000000');
    expect(pickContrastText('#ff7a1a')).toBe('#000000');
  });
});

import { describe, it, expect } from 'vitest';
import { stripUndefined } from '../stripUndefined';

describe('stripUndefined', () => {
  it('drops top-level undefined keys', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('keeps null, false, 0, empty string', () => {
    expect(stripUndefined({ a: null, b: false, c: 0, d: '' })).toEqual({ a: null, b: false, c: 0, d: '' });
  });

  it('recurses into nested objects', () => {
    const input = { outer: { kept: 1, gone: undefined }, sibling: undefined };
    expect(stripUndefined(input)).toEqual({ outer: { kept: 1 } });
  });

  it('recurses into arrays of objects', () => {
    const input = { items: [{ id: '1', icon: undefined }, { id: '2', icon: 'home' }] };
    expect(stripUndefined(input)).toEqual({ items: [{ id: '1' }, { id: '2', icon: 'home' }] });
  });

  it('returns primitives unchanged', () => {
    expect(stripUndefined('hello')).toBe('hello');
    expect(stripUndefined(42)).toBe(42);
    expect(stripUndefined(null)).toBe(null);
  });

  it('leaves arrays of primitives alone', () => {
    expect(stripUndefined({ a: [1, 2, 3] })).toEqual({ a: [1, 2, 3] });
  });
});

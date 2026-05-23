import { describe, it, expect } from 'vitest';
import { generateSlug, ensureUniqueSlug } from '../api';

describe('generateSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(generateSlug('Pinjol Survival Kit')).toBe('pinjol-survival-kit');
  });

  it('strips non-alphanumeric characters', () => {
    expect(generateSlug('Hello, World! @2026')).toBe('hello-world-2026');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(generateSlug('a   b---c')).toBe('a-b-c');
  });

  it('trims leading/trailing hyphens', () => {
    expect(generateSlug('  --hello--  ')).toBe('hello');
  });

  it('handles Indonesian characters', () => {
    expect(generateSlug('Belajar Keuangan')).toBe('belajar-keuangan');
  });

  it('returns empty string for input with no alphanumerics', () => {
    expect(generateSlug('---!!!---')).toBe('');
  });
});

describe('ensureUniqueSlug', () => {
  it('returns input slug when not taken', () => {
    const taken = new Set<string>();
    expect(ensureUniqueSlug('hello', taken)).toBe('hello');
  });

  it('appends -2 when input is taken', () => {
    const taken = new Set(['hello']);
    expect(ensureUniqueSlug('hello', taken)).toBe('hello-2');
  });

  it('keeps incrementing until unique', () => {
    const taken = new Set(['hello', 'hello-2', 'hello-3']);
    expect(ensureUniqueSlug('hello', taken)).toBe('hello-4');
  });

  it('handles empty taken set', () => {
    expect(ensureUniqueSlug('whatever', new Set())).toBe('whatever');
  });
});

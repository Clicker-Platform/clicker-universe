import { describe, it, expect } from 'vitest';
import { suggestSlug } from '../slug';

describe('suggestSlug', () => {
  it('lowercases and kebab-cases simple business names', () => {
    expect(suggestSlug('Warung Kopi Sederhana')).toBe('warung-kopi-sederhana');
  });

  it('strips diacritics (NFD normalize)', () => {
    expect(suggestSlug('Café Olé')).toBe('cafe-ole');
  });

  it('collapses multiple spaces and special chars to single dash', () => {
    expect(suggestSlug('Foo   &  Bar!!!')).toBe('foo-bar');
  });

  it('trims leading/trailing dashes', () => {
    expect(suggestSlug('---hello world---')).toBe('hello-world');
  });

  it('returns empty string for input with no alphanumerics', () => {
    expect(suggestSlug('!!!@@@###')).toBe('');
  });
});

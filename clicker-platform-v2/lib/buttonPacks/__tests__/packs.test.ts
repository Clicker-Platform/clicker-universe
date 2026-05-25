import { describe, it, expect } from 'vitest';
import { BUTTON_PACKS, getButtonPackById, getDefaultButtonPack } from '../packs';
import { DEFAULT_BUTTON_PACK_ID } from '../types';

describe('BUTTON_PACKS', () => {
  it('exposes 5 packs', () => {
    expect(BUTTON_PACKS).toHaveLength(5);
  });
  it('contains pill, soft, brutalist, glass, underlined', () => {
    const ids = BUTTON_PACKS.map(p => p.id).sort();
    expect(ids).toEqual(['brutalist', 'glass', 'pill', 'soft', 'underlined']);
  });
  it('each pack has 3 sizes (sm/md/lg)', () => {
    for (const p of BUTTON_PACKS) {
      expect(Object.keys(p.sizes).sort()).toEqual(['lg', 'md', 'sm']);
    }
  });
});

describe('getButtonPackById', () => {
  it('returns pack by id', () => {
    expect(getButtonPackById('pill')?.id).toBe('pill');
  });
  it('returns null for unknown id', () => {
    expect(getButtonPackById('nope' as any)).toBeNull();
  });
  it('returns null for null input', () => {
    expect(getButtonPackById(null)).toBeNull();
  });
});

describe('getDefaultButtonPack', () => {
  it('returns the pack matching DEFAULT_BUTTON_PACK_ID', () => {
    expect(getDefaultButtonPack().id).toBe(DEFAULT_BUTTON_PACK_ID);
  });
});

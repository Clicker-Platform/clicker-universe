import { describe, it, expect } from 'vitest';
import { BUNDLES, getBundleById } from '../bundles';

describe('registration bundles', () => {
  it('all bundles have unique ids', () => {
    const ids = BUNDLES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all bundles have at least one module', () => {
    for (const bundle of BUNDLES) {
      expect(bundle.modules.length).toBeGreaterThan(0);
    }
  });

  it('getBundleById returns bundle for known id', () => {
    const bundle = getBundleById('restaurant-starter');
    expect(bundle).toBeDefined();
    expect(bundle?.id).toBe('restaurant-starter');
  });

  it('getBundleById returns undefined for unknown id', () => {
    expect(getBundleById('does-not-exist')).toBeUndefined();
  });
});

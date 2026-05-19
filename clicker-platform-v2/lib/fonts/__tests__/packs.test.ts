import { describe, it, expect } from 'vitest';
import { FONT_PACKS, getPackById, DEFAULT_PACK_ID, KNOWN_CSS_VARS } from '../packs';
import { templates } from '@/lib/templates/registry';

describe('FONT_PACKS catalog', () => {
  it('ships at least 8 packs', () => {
    expect(FONT_PACKS.length).toBeGreaterThanOrEqual(8);
  });

  it('every pack has a unique id', () => {
    const ids = FONT_PACKS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pack references known CSS variables', () => {
    for (const pack of FONT_PACKS) {
      expect(KNOWN_CSS_VARS).toContain(pack.heading.cssVar);
      expect(KNOWN_CSS_VARS).toContain(pack.body.cssVar);
    }
  });

  it('DEFAULT_PACK_ID resolves to a real pack', () => {
    expect(getPackById(DEFAULT_PACK_ID)).toBeDefined();
  });

  it('getPackById returns undefined for unknown ids', () => {
    expect(getPackById('not-a-real-pack')).toBeUndefined();
  });

  it('every template defaultFontPackId resolves to a real pack', () => {
    for (const id of Object.keys(templates)) {
      const t = templates[id];
      expect(t.config.defaultFontPackId, `template ${id} defaultFontPackId`).toBeDefined();
      expect(getPackById(t.config.defaultFontPackId), `template ${id} -> ${t.config.defaultFontPackId} must exist`).toBeDefined();
    }
  });
});

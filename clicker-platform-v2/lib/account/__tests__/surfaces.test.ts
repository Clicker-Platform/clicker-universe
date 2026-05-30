import { describe, it, expect } from 'vitest';
import { resolveVisibleSurfaces } from '../surfaces';
import type { ModuleDefinition } from '@/lib/modules/types';

const ctx = { siteId: 's1', uid: 'u1' };

function mod(id: string, surface?: Partial<NonNullable<ModuleDefinition['memberSurface']>>): ModuleDefinition {
  return {
    id, displayName: id, icon: 'box', version: '1', enabled: true,
    ...(surface
      ? { memberSurface: { id: surface.id ?? id, label: 'L', icon: 'box', route: '/x', componentKey: 'k', ...surface } }
      : {}),
  } as ModuleDefinition;
}

describe('resolveVisibleSurfaces', () => {
  it('skips modules without a memberSurface', async () => {
    expect(await resolveVisibleSurfaces([mod('a')], ctx)).toEqual([]);
  });
  it('hides a surface when both isGranted and hasData are unset', async () => {
    expect(await resolveVisibleSurfaces([mod('a', {})], ctx)).toEqual([]);
  });
  it('shows when isGranted returns true (ignores hasData)', async () => {
    const r = await resolveVisibleSurfaces([mod('a', { isGranted: () => true, hasData: () => false })], ctx);
    expect(r).toHaveLength(1);
  });
  it('falls back to hasData when isGranted unset', async () => {
    const yes = await resolveVisibleSurfaces([mod('a', { hasData: () => true })], ctx);
    const no  = await resolveVisibleSurfaces([mod('b', { hasData: () => false })], ctx);
    expect(yes).toHaveLength(1);
    expect(no).toHaveLength(0);
  });
  it('respects isGranted=false even if hasData would be true', async () => {
    const r = await resolveVisibleSurfaces([mod('a', { isGranted: () => false, hasData: () => true })], ctx);
    expect(r).toHaveLength(0);
  });
  it('supports async predicates', async () => {
    const r = await resolveVisibleSurfaces([mod('a', { hasData: async () => true })], ctx);
    expect(r).toHaveLength(1);
  });
  it('skips disabled modules even with a granted surface', async () => {
    const m = mod('a', { isGranted: () => true });
    (m as { enabled: boolean }).enabled = false;
    expect(await resolveVisibleSurfaces([m], ctx)).toEqual([]);
  });
});

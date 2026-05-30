import { describe, it, expect, vi } from 'vitest';

const { getDocsMock, hasDataFn } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  hasDataFn: vi.fn(async () => true),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: (...a: unknown[]) => getDocsMock(...a),
  getDoc: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('@/lib/logger-edge', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

vi.mock('../definitions', () => ({
  STATIC_MODULE_DEFINITIONS: {
    digital_goods: {
      memberSurface: {
        id: 'library',
        label: 'My Library',
        icon: 'box',
        route: '/library',
        componentKey: 'k',
        hasData: hasDataFn,
      },
    },
  },
}));

import { getEnabledModuleDefinitions } from '../registry';

describe('getEnabledModuleDefinitions', () => {
  it('merges STATIC memberSurface (with function predicate) onto enabled Firestore modules', async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: 'digital_goods',
          data: () => ({ enabled: true, displayName: 'Digital Goods', icon: 'shopping-bag', version: '1' }),
        },
      ],
    });
    const mods = await getEnabledModuleDefinitions();
    expect(mods).toHaveLength(1);
    expect(mods[0].id).toBe('digital_goods');
    // THE critical assertion: the function predicate survives the Firestore merge.
    expect(typeof mods[0].memberSurface?.hasData).toBe('function');
    expect(mods[0].memberSurface?.route).toBe('/library');
    // Firestore-provided fields are still present.
    expect(mods[0].displayName).toBe('Digital Goods');
  });

  it('returns an enabled module with no static def (no extras) and still includes it', async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: 'unknown_mod',
          data: () => ({ enabled: true, displayName: 'X', icon: 'box', version: '1' }),
        },
      ],
    });
    const mods = await getEnabledModuleDefinitions();
    expect(mods).toHaveLength(1);
    expect(mods[0].id).toBe('unknown_mod');
    expect(mods[0].memberSurface).toBeUndefined();
  });
});

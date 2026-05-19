import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAppearanceStyles, setFontPackId } from '../api';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => {
  const getData = (): Record<string, any> => {
    const g = globalThis as any;
    if (!g.__appearanceData) g.__appearanceData = {};
    return g.__appearanceData;
  };
  return {
    doc: (_db: any, ...path: string[]) => ({ path: path.join('/') }),
    getDoc: async (ref: any) => {
      const data = getData();
      return {
        exists: () => ref.path in data,
        data: () => data[ref.path],
      };
    },
    setDoc: async (ref: any, value: any, _opts?: any) => {
      const data = getData();
      data[ref.path] = { ...(data[ref.path] ?? {}), ...value };
    },
    serverTimestamp: () => new Date(),
  };
});

describe('appearance api', () => {
  beforeEach(() => { (globalThis as any).__appearanceData = {}; });

  it('returns default styles when no doc exists', async () => {
    const styles = await getAppearanceStyles('site-1');
    expect(styles.fontPackId).toBeNull();
  });

  it('round-trips fontPackId', async () => {
    await setFontPackId('site-1', 'modern-geometric');
    const styles = await getAppearanceStyles('site-1');
    expect(styles.fontPackId).toBe('modern-geometric');
  });

  it('setFontPackId(null) clears the pack', async () => {
    await setFontPackId('site-1', 'editorial-serif');
    await setFontPackId('site-1', null);
    const styles = await getAppearanceStyles('site-1');
    expect(styles.fontPackId).toBeNull();
  });
});

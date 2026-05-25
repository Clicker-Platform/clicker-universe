import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAppearanceStyles, setFontPackId } from '../api';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => {
  const getData = (): Record<string, any> => {
    const g = globalThis as any;
    if (!g.__appearanceData) g.__appearanceData = {};
    return g.__appearanceData;
  };

  /** Detect a deleteField() sentinel by its _methodName property */
  const isDeleteSentinel = (v: unknown): boolean =>
    typeof v === 'object' && v !== null && (v as any)._methodName === 'FieldValue.delete';

  /**
   * Merge `updates` into `existing`, expanding dotted-path keys and honouring
   * deleteField() sentinels — mirrors Firestore's { merge: true } behaviour.
   */
  function mergeWithDotPaths(existing: Record<string, any>, updates: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...existing };
    for (const [key, value] of Object.entries(updates)) {
      const parts = key.split('.');
      if (parts.length === 1) {
        if (isDeleteSentinel(value)) {
          delete result[key];
        } else {
          result[key] = value;
        }
      } else {
        // Expand dotted path: e.g. "buttonColors.primaryFill" -> result.buttonColors.primaryFill
        let node = result;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (typeof node[part] !== 'object' || node[part] === null) {
            node[part] = {};
          } else {
            node[part] = { ...node[part] };
          }
          node = node[part];
        }
        const leaf = parts[parts.length - 1];
        if (isDeleteSentinel(value)) {
          delete node[leaf];
        } else {
          node[leaf] = value;
        }
      }
    }
    return result;
  }

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
      data[ref.path] = mergeWithDotPaths(data[ref.path] ?? {}, value);
    },
    serverTimestamp: () => new Date(),
    deleteField: () => ({ _methodName: 'FieldValue.delete' }),
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

import { setButtonPackId, setButtonColors } from '../api';

describe('appearance api — buttons', () => {
  beforeEach(() => { (globalThis as any).__appearanceData = {}; });

  it('default styles include null buttonPackId and default buttonColors', async () => {
    const styles = await getAppearanceStyles('site-1');
    expect(styles.buttonPackId).toBeNull();
    expect(styles.buttonColors.primaryFill).toBe('#111111');
    expect(styles.buttonColors.secondaryBorder).toBe('#111111');
    expect(styles.buttonColors.secondaryText).toBe('#111111');
    expect(styles.buttonColors.tertiaryText).toBe('#111111');
    expect(styles.buttonColors.primaryText).toBeUndefined();
  });

  it('setButtonPackId persists the pack id', async () => {
    await setButtonPackId('site-1', 'soft');
    const styles = await getAppearanceStyles('site-1');
    expect(styles.buttonPackId).toBe('soft');
  });

  it('setButtonPackId(null) clears the pack', async () => {
    await setButtonPackId('site-1', 'soft');
    await setButtonPackId('site-1', null);
    const styles = await getAppearanceStyles('site-1');
    expect(styles.buttonPackId).toBeNull();
  });

  it('setButtonColors merges with existing colors', async () => {
    await setButtonColors('site-1', { primaryFill: '#2563eb' });
    const styles = await getAppearanceStyles('site-1');
    expect(styles.buttonColors.primaryFill).toBe('#2563eb');
    expect(styles.buttonColors.secondaryBorder).toBe('#111111');
  });

  it('setButtonColors can clear primaryText override', async () => {
    await setButtonColors('site-1', { primaryFill: '#2563eb', primaryText: '#fafafa' });
    let styles = await getAppearanceStyles('site-1');
    expect(styles.buttonColors.primaryText).toBe('#fafafa');

    await setButtonColors('site-1', { primaryText: undefined });
    styles = await getAppearanceStyles('site-1');
    expect(styles.buttonColors.primaryText).toBeUndefined();
  });
});

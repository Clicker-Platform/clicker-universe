import { describe, it, expect } from 'vitest';
import { filterVisibleWidgets, defaultVisibleWidgets } from '../dashboard-overview';
import type { ModuleDefinition } from '../types';

const makeModule = (id: string, hasWidget = true): ModuleDefinition => ({
  id,
  displayName: id,
  icon: 'cog',
  version: '1.0.0',
  enabled: true,
  ...(hasWidget ? { adminDashboardWidget: { componentKey: `${id}:DashboardWidget` } } : {}),
});

describe('filterVisibleWidgets', () => {
  it('drops ids for modules that are not enabled', () => {
    const stored = ['membership', 'byod_pos', 'gone'];
    const modules = [makeModule('membership'), makeModule('byod_pos')];
    expect(filterVisibleWidgets(stored, modules)).toEqual(['membership', 'byod_pos']);
  });

  it('drops ids for modules without an adminDashboardWidget', () => {
    const stored = ['membership', 'no_widget'];
    const modules = [makeModule('membership'), makeModule('no_widget', false)];
    expect(filterVisibleWidgets(stored, modules)).toEqual(['membership']);
  });

  it('preserves the stored order', () => {
    const stored = ['byod_pos', 'membership'];
    const modules = [makeModule('membership'), makeModule('byod_pos')];
    expect(filterVisibleWidgets(stored, modules)).toEqual(['byod_pos', 'membership']);
  });
});

describe('defaultVisibleWidgets', () => {
  it('returns first 3 modules with widgets in input order', () => {
    const modules = [
      makeModule('a'),
      makeModule('no_widget', false),
      makeModule('b'),
      makeModule('c'),
      makeModule('d'),
    ];
    expect(defaultVisibleWidgets(modules)).toEqual(['a', 'b', 'c']);
  });

  it('returns fewer than 3 if not enough widget-capable modules', () => {
    const modules = [makeModule('a'), makeModule('no_widget', false)];
    expect(defaultVisibleWidgets(modules)).toEqual(['a']);
  });
});

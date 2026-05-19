import { describe, it, expect } from 'vitest';
import { synthesizeHeaderConfig } from '../headerNavigation';
import type { HeaderNavigationConfig } from '@/data/mockData';

describe('synthesizeHeaderConfig', () => {
  it('returns new-site defaults when legacy navigation is empty', () => {
    const result = synthesizeHeaderConfig(undefined);
    expect(result.variant).toBe('logo-left');
    expect(result.width).toBe('constrained');
    expect(result.scrollBehavior).toBe('fixed');
    expect(result.typography.preset).toBe('default');
    expect(result.items).toEqual([]);
    expect(result.cta.enabled).toBe(false);
    expect(result.scrolledAppearance.enabled).toBe(false);
  });

  it('preserves existing tenant look when legacy fields are present', () => {
    const legacy = {
      topNav: [{ id: '1', label: 'Home', type: 'link' as const, value: '/' }],
      topNavActions: {
        cta: { enabled: true, label: 'Book', linkType: 'url' as const, linkValue: 'https://x.test' },
      },
      headerStyle: { bgColor: '#000000', showBorder: true },
    };
    const result = synthesizeHeaderConfig(legacy);
    expect(result.variant).toBe('logo-left');
    expect(result.width).toBe('full'); // preserves today's full-bleed
    expect(result.scrollBehavior).toBe('fixed');
    expect(result.typography.preset).toBe('spacious'); // preserves tracking-[0.2em] look
    expect(result.items).toEqual(legacy.topNav);
    expect(result.cta).toEqual(legacy.topNavActions.cta);
    expect(result.bgColor).toBe('#000000');
    expect(result.showBorder).toBe(true);
  });

  it('handles partial legacy state', () => {
    const result = synthesizeHeaderConfig({ topNav: [], headerStyle: { showBorder: false } });
    expect(result.width).toBe('full');
    expect(result.typography.preset).toBe('spacious');
    expect(result.showBorder).toBe(false);
    expect(result.cta.enabled).toBe(false);
  });

  it('passes through when navigation.header is already present', () => {
    const existing: HeaderNavigationConfig = {
      variant: 'logo-center',
      width: 'constrained',
      scrollBehavior: 'sticky-on-scroll-up',
      items: [],
      cta: { enabled: false, label: '', linkType: 'url', linkValue: '' },
      typography: { preset: 'tight' },
      scrolledAppearance: { enabled: false },
    };
    const result = synthesizeHeaderConfig({ header: existing });
    expect(result).toEqual(existing);
  });
});

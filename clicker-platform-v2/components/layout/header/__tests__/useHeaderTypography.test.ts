import { describe, it, expect } from 'vitest';
import { resolveHeaderTypographyClass } from '../useHeaderTypography';
import type { HeaderTypography } from '@/data/mockData';

describe('resolveHeaderTypographyClass', () => {
  it('returns default preset class', () => {
    const result = resolveHeaderTypographyClass({ preset: 'default' });
    expect(result).toContain('text-sm');
    expect(result).toContain('font-medium');
    expect(result).toContain('tracking-normal');
    expect(result).not.toContain('uppercase');
  });

  it('returns spacious preset class with uppercase', () => {
    const result = resolveHeaderTypographyClass({ preset: 'spacious' });
    expect(result).toContain('text-xs');
    expect(result).toContain('font-bold');
    expect(result).toContain('tracking-[0.2em]');
    expect(result).toContain('uppercase');
  });

  it('applies tracking override', () => {
    const cfg: HeaderTypography = { preset: 'spacious', trackingOverride: 'tight' };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).toContain('tracking-tight');
    expect(result).not.toContain('tracking-[0.2em]');
  });

  it('applies case override (none) on uppercase preset', () => {
    const cfg: HeaderTypography = { preset: 'spacious', caseOverride: 'none' };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).not.toContain('uppercase');
  });

  it('applies case override (uppercase) on default preset', () => {
    const cfg: HeaderTypography = { preset: 'default', caseOverride: 'uppercase' };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).toContain('uppercase');
  });
});

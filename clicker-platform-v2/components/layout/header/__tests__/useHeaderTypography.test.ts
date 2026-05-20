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

  it('applies size override and replaces preset size', () => {
    const cfg: HeaderTypography = { preset: 'default', sizeOverride: 'lg' };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).toContain('text-lg');
    expect(result).not.toContain('text-sm');
  });

  it('applies weight override and replaces preset weight', () => {
    const cfg: HeaderTypography = { preset: 'spacious', weightOverride: 'normal' };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).toContain('font-normal');
    expect(result).not.toContain('font-bold');
  });

  it('combines size + weight overrides with other overrides cleanly', () => {
    const cfg: HeaderTypography = {
      preset: 'spacious',
      sizeOverride: 'md',
      weightOverride: 'semibold',
      caseOverride: 'none',
    };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).toContain('text-base');
    expect(result).toContain('font-semibold');
    expect(result).not.toContain('text-xs');
    expect(result).not.toContain('font-bold');
    expect(result).not.toContain('uppercase');
  });
});

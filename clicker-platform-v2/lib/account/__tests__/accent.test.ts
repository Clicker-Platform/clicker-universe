import { describe, it, expect } from 'vitest';
import { resolveAccentVars, DEFAULT_ACCENT_PRESET } from '../accent';

describe('resolveAccentVars', () => {
  it('defaults to coral when unset', () => {
    expect(DEFAULT_ACCENT_PRESET).toBe('coral');
    expect(resolveAccentVars(undefined)['--account-accent']).toBe('#FF6B5E');
  });
  it('maps a chosen preset', () => {
    const v = resolveAccentVars('indigo');
    expect(v['--account-accent']).toBe('#6366F1');
    expect(v['--account-accent-fg']).toBe('#ffffff');
    expect(v['--account-accent-soft']).toBe('#EEF0FF');
  });
});

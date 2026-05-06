import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAllowedInDev } from '../guard';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.EMAIL_DEV_ALLOWLIST;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isAllowedInDev', () => {
  it('allows everything in production regardless of address', () => {
    process.env.NODE_ENV = 'production';
    expect(isAllowedInDev(['random@example.com'])).toBe(true);
  });

  it('blocks non-allowlisted in dev', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['random@example.com'])).toBe(false);
  });

  it('allows @clicker.id in dev (default)', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['hello@clicker.id'])).toBe(true);
  });

  it('allows @resend.dev in dev (default)', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['test@resend.dev'])).toBe(true);
  });

  it('allows configured suffixes via EMAIL_DEV_ALLOWLIST', () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_DEV_ALLOWLIST = '@example.com';
    expect(isAllowedInDev(['user@example.com'])).toBe(true);
    expect(isAllowedInDev(['user@clicker.id'])).toBe(false);
  });

  it('returns false if ANY recipient is non-allowlisted', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['ok@clicker.id', 'bad@example.com'])).toBe(false);
  });

  it('case-insensitive matching', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['User@CLICKER.ID'])).toBe(true);
  });
});

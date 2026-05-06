import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveDefaultSender, getDevAllowlistSuffixes, getSystemDefaults } from '../config';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.EMAIL_SENDER_DOMAIN;
  delete process.env.EMAIL_SENDER_LOCAL_PART;
  delete process.env.EMAIL_SYSTEM_FROM_NAME;
  delete process.env.EMAIL_DEV_ALLOWLIST;
  delete process.env.EMAIL_PLATFORM_LOGO_URL;
  delete process.env.EMAIL_PLATFORM_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveDefaultSender', () => {
  it('falls back to onboarding@resend.dev in dev with no EMAIL_SENDER_DOMAIN', () => {
    process.env.NODE_ENV = 'development';
    expect(resolveDefaultSender()).toEqual({ localPart: 'onboarding', domain: 'resend.dev' });
  });

  it('uses configured domain and default local-part in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_SENDER_DOMAIN = 'clicker.id';
    expect(resolveDefaultSender()).toEqual({ localPart: 'noreply', domain: 'clicker.id' });
  });

  it('respects EMAIL_SENDER_LOCAL_PART override', () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_SENDER_DOMAIN = 'clicker.id';
    process.env.EMAIL_SENDER_LOCAL_PART = 'hello';
    expect(resolveDefaultSender()).toEqual({ localPart: 'hello', domain: 'clicker.id' });
  });
});

describe('getDevAllowlistSuffixes', () => {
  it('returns built-in defaults when EMAIL_DEV_ALLOWLIST unset', () => {
    expect(getDevAllowlistSuffixes()).toEqual(['@clicker.id', '@resend.dev']);
  });

  it('parses comma-separated EMAIL_DEV_ALLOWLIST', () => {
    process.env.EMAIL_DEV_ALLOWLIST = '@example.com, @test.io';
    expect(getDevAllowlistSuffixes()).toEqual(['@example.com', '@test.io']);
  });
});

describe('getSystemDefaults', () => {
  it('uses fallback values when env vars unset', () => {
    const d = getSystemDefaults();
    expect(d.fromName).toBe('Clicker Platform');
    expect(d.platformUrl).toBe('https://clicker.id');
    expect(d.logoUrl).toBeNull();
  });

  it('reads EMAIL_SYSTEM_FROM_NAME, EMAIL_PLATFORM_URL, EMAIL_PLATFORM_LOGO_URL', () => {
    process.env.EMAIL_SYSTEM_FROM_NAME = 'Custom Name';
    process.env.EMAIL_PLATFORM_URL = 'https://example.com';
    process.env.EMAIL_PLATFORM_LOGO_URL = 'https://example.com/logo.png';
    const d = getSystemDefaults();
    expect(d.fromName).toBe('Custom Name');
    expect(d.platformUrl).toBe('https://example.com');
    expect(d.logoUrl).toBe('https://example.com/logo.png');
  });
});

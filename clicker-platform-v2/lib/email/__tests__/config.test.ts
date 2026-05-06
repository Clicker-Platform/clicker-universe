import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveDefaultSender, getDevAllowlistSuffixes, getSystemDefaults, getTemplateAliases } from '../config';

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
  it('defaults to noreply@clicker.id when no env vars set', () => {
    expect(resolveDefaultSender()).toEqual({ localPart: 'noreply', domain: 'clicker.id' });
  });

  it('uses EMAIL_SENDER_DOMAIN override when set', () => {
    process.env.EMAIL_SENDER_DOMAIN = 'custom.example.com';
    expect(resolveDefaultSender()).toEqual({ localPart: 'noreply', domain: 'custom.example.com' });
  });

  it('respects EMAIL_SENDER_LOCAL_PART override', () => {
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

describe('getTemplateAliases', () => {
  it('returns hardcoded defaults when env vars not set', () => {
    delete process.env.RESEND_TEMPLATE_PASSWORD_RESET;
    delete process.env.RESEND_TEMPLATE_EMAIL_VERIFY;
    delete process.env.RESEND_TEMPLATE_FORM_SUBMISSION;
    delete process.env.RESEND_TEMPLATE_SYSTEM_ALERT;
    const aliases = getTemplateAliases();
    expect(aliases.passwordReset).toBe('password-reset');
    expect(aliases.emailVerification).toBe('email-verification');
    expect(aliases.formSubmission).toBe('form-submission');
    expect(aliases.systemAlert).toBe('system-alert');
  });

  it('reads from env vars when set', () => {
    process.env.RESEND_TEMPLATE_PASSWORD_RESET = 'pw-reset-v2';
    process.env.RESEND_TEMPLATE_EMAIL_VERIFY = 'verify-v2';
    const aliases = getTemplateAliases();
    expect(aliases.passwordReset).toBe('pw-reset-v2');
    expect(aliases.emailVerification).toBe('verify-v2');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { getDevAllowlistSuffixes } from '../config';

// getDevAllowlistSuffixes is the only sync function — test it directly.
// resolveDefaultSender, getSystemDefaults, getTemplateAliases are async
// and depend on Firestore; tested via integration or mocked in sender tests.

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.EMAIL_DEV_ALLOWLIST;
  process.env = { ...ORIGINAL_ENV };
});

describe('getDevAllowlistSuffixes', () => {
  it('returns built-in defaults when EMAIL_DEV_ALLOWLIST unset', () => {
    delete process.env.EMAIL_DEV_ALLOWLIST;
    expect(getDevAllowlistSuffixes()).toEqual(['@clicker.id', '@resend.dev']);
  });

  it('parses comma-separated EMAIL_DEV_ALLOWLIST', () => {
    process.env.EMAIL_DEV_ALLOWLIST = '@example.com, @test.io';
    expect(getDevAllowlistSuffixes()).toEqual(['@example.com', '@test.io']);
  });
});

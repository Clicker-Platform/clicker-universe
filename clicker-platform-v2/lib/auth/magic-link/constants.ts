// Magic-link shared constants.
// Firestore paths intentionally global (top-level), not per-site, so the
// /auth/verify handler can locate a token without trusting the URL's siteId.

export const COLLECTION_SIGN_IN_TOKENS = 'signInTokens';
export const COLLECTION_RATE_LIMITS = 'rateLimits';
export const RATE_LIMIT_EMAIL_BUCKET = 'email';

export const TOKEN_TTL_MS = 15 * 60 * 1000;
export const TOKEN_TTL_MINUTES = 15;

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_PER_WINDOW = 3;

// Template-alias KEY (looked up via getTemplateAliases()).
// The actual Resend template alias string lives in lib/email/config.ts DEFAULTS.
export const EMAIL_ALIAS_KEY_AUTH_MAGIC_LINK = 'authMagicLink';

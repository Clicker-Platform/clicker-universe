import 'server-only';
import { adminDb, Timestamp, FieldValue } from '@/lib/firebase-admin';
import { sendEmail, getTemplateAliases } from '@/lib/email';
import { logger } from '@/lib/logger';
import {
  COLLECTION_SIGN_IN_TOKENS,
  EMAIL_ALIAS_KEY_AUTH_MAGIC_LINK,
  TOKEN_TTL_MINUTES,
  TOKEN_TTL_MS,
} from './constants';
import { generateToken, hashEmail, isValidEmail } from './tokens';
import { checkAndIncrementEmailLimit } from './rate-limit';
import type { MagicLinkInput } from './types';

// Always resolves void to prevent email enumeration. All failure modes are
// logged server-side only.
export async function requestMagicLink(input: MagicLinkInput): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    logger.warn('magic_link.request.invalid_email', { siteId: input.siteId, module: input.module });
    return;
  }

  const emailHash = hashEmail(email);

  const allowed = await checkAndIncrementEmailLimit(emailHash).catch((e) => {
    logger.error('magic_link.request.rate_limit.error', { error: e });
    return true; // fail-open on rate-limit infra error
  });
  if (!allowed) {
    logger.warn('magic_link.request.rate_limited', { siteId: input.siteId, module: input.module, emailHash });
    return;
  }

  const token = generateToken();
  const expiresAt = Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS);

  try {
    await adminDb.doc(`${COLLECTION_SIGN_IN_TOKENS}/${token}`).set({
      email,
      emailHash,
      siteId: input.siteId,
      module: input.module,
      redirectUrl: input.redirectUrl,
      expiresAt,
      used: false,
      usedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    logger.error('magic_link.request.token_persist_failed', { siteId: input.siteId, module: input.module, error: e });
    return;
  }

  const sep = input.verifyUrl.includes('?') ? '&' : '?';
  const signinUrl = `${input.verifyUrl}${sep}token=${encodeURIComponent(token)}`;

  const aliases = await getTemplateAliases();
  const templateAlias = aliases[EMAIL_ALIAS_KEY_AUTH_MAGIC_LINK] ?? 'auth-magic-link';

  const result = await sendEmail({
    to: email,
    siteId: input.siteId,
    templateAlias,
    variables: {
      signinUrl,
      tenantName: input.tenantName,
      purpose: input.purpose,
      expiresInMinutes: String(TOKEN_TTL_MINUTES),
    },
    tags: [
      { name: 'module', value: input.module },
      { name: 'event', value: 'magic_link' },
    ],
  });

  if (!result.ok) {
    logger.error('magic_link.request.email_send_failed', {
      siteId: input.siteId,
      module: input.module,
      error: result.error,
    });
  }
}

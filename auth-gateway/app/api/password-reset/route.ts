import { NextResponse } from 'next/server';
import { createElement } from 'react';
import { adminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSiteFromEmail } from '@/lib/resolve-site-from-email';
import { sendEmail, PasswordReset } from '@/lib/email';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`password-reset:${ip}`)) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: true });
    }

    const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL ?? 'http://localhost:3012';
    let resetLink: string;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(email, {
        url: `${gatewayUrl}/reset-callback`,
        handleCodeInApp: false,
      });
    } catch {
      // Email not found in Firebase Auth — return ok without sending
      return NextResponse.json({ ok: true });
    }

    const siteId = await resolveSiteFromEmail(email);

    await sendEmail({
      to: email,
      siteId,
      subject: 'Reset your password',
      template: createElement(PasswordReset, { resetUrl: resetLink }),
      tags: [{ name: 'template', value: 'password-reset' }],
    });
  } catch (error) {
    logger.error('auth.password-reset.failed', { error });
  }

  return NextResponse.json({ ok: true });
}

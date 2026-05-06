import { NextResponse } from 'next/server';
import { createElement } from 'react';
import { adminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSiteFromEmail } from '@/lib/resolve-site-from-email';
import { sendEmail, EmailVerification } from '@/lib/email';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`email-verification:${ip}`)) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: true });
    }

    let verifyLink: string;
    try {
      verifyLink = await adminAuth.generateEmailVerificationLink(email);
    } catch {
      return NextResponse.json({ ok: true });
    }

    const siteId = await resolveSiteFromEmail(email);

    await sendEmail({
      to: email,
      siteId,
      subject: 'Verify your email address',
      template: createElement(EmailVerification, { verifyUrl: verifyLink }),
      tags: [{ name: 'template', value: 'email-verification' }],
    });
  } catch (error) {
    logger.error('auth.email-verification.failed', { error });
  }

  return NextResponse.json({ ok: true });
}

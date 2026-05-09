import { isAllowedInDev } from './guard';
import { logEmail } from './log';
import { callResend } from './resend-client';
import type { SendEmailInput, SendEmailResult } from './types';

function getFromHeader(): string {
  const name = process.env.EMAIL_SYSTEM_FROM_NAME ?? 'Clicker Platform';
  const local = process.env.EMAIL_SENDER_LOCAL_PART ?? 'noreply';
  const domain = process.env.EMAIL_SENDER_DOMAIN ?? 'clicker.id';
  return `${name} <${local}@${domain}>`;
}

function getFromAddress(): string {
  const local = process.env.EMAIL_SENDER_LOCAL_PART ?? 'noreply';
  const domain = process.env.EMAIL_SENDER_DOMAIN ?? 'clicker.id';
  return `${local}@${domain}`;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const fromHeader = getFromHeader();
  const fromAddress = getFromAddress();

  if (!isAllowedInDev(input.to)) {
    await logEmail({
      to: input.to,
      templateAlias: input.templateAlias,
      fromAddress,
      status: 'dev_blocked',
      resendId: null,
      error: null,
      registrationId: input.registrationId,
    });
    return { ok: true, resendId: 'dev_blocked' };
  }

  try {
    const result = await callResend({
      from: fromHeader,
      to: input.to,
      templateAlias: input.templateAlias,
      variables: input.variables,
    });
    await logEmail({
      to: input.to,
      templateAlias: input.templateAlias,
      fromAddress,
      status: 'sent',
      resendId: result.id ?? null,
      error: null,
      registrationId: input.registrationId,
    });
    return { ok: true, resendId: result.id ?? '' };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await logEmail({
      to: input.to,
      templateAlias: input.templateAlias,
      fromAddress,
      status: 'failed',
      resendId: null,
      error: errorMessage,
      registrationId: input.registrationId,
    });
    return { ok: false, error: errorMessage };
  }
}

import { logger } from '@/lib/logger';
import { getResendClient } from './resend-client';
import { getEmailContext } from './context';
import { renderTemplate } from './render';
import { isAllowedInDev } from './guard';
import { newLogDocRef, writeEmailLog } from './log';
import { formatFrom, resolveDefaultSender } from './config';
import type { SendEmailInput, SendEmailResult, EmailTag } from './types';

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const toList = toArray(input.to);
  const ccList = toArray(input.cc);
  const bccList = toArray(input.bcc);

  const context = await getEmailContext(input.siteId);
  const sender = resolveDefaultSender();
  const fromHeader = formatFrom(context.fromName, sender);
  const replyTo = input.replyTo ?? context.replyTo ?? undefined;

  const logRef = newLogDocRef(input.siteId);
  const baseLog = {
    to: toList,
    cc: ccList.length ? ccList : null,
    bcc: bccList.length ? bccList : null,
    subject: input.subject,
    fromName: context.fromName,
    fromAddress: context.fromAddress,
    replyTo: replyTo ?? null,
    siteId: input.siteId,
    tags: input.tags ?? [],
    attemptCount: 1,
  };

  if (!isAllowedInDev(toList)) {
    const devTags: EmailTag[] = [
      ...(input.tags ?? []),
      { name: 'dev_blocked', value: 'true' },
    ];
    await writeEmailLog(logRef, {
      ...baseLog,
      tags: devTags,
      status: 'sent',
      resendId: null,
      error: null,
      errorCode: null,
      sentAt: new Date(),
    });
    logger.info('email.dev.blocked', { to: toList.join(','), subject: input.subject });
    return { ok: true, id: 'dev_blocked', logId: logRef.id };
  }

  let html: string;
  let text: string;
  try {
    const rendered = await renderTemplate(input.template);
    html = rendered.html;
    text = rendered.text;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await writeEmailLog(logRef, {
      ...baseLog,
      status: 'failed',
      resendId: null,
      error: `Template render failed: ${error}`,
      errorCode: 'render_error',
      sentAt: null,
    });
    logger.error('email.render.failed', { siteId: input.siteId ?? undefined, error });
    return { ok: false, error: `Template render failed: ${error}`, logId: logRef.id };
  }

  try {
    const client = getResendClient();
    const resp = await client.emails.send({
      from: fromHeader,
      to: toList,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      replyTo: replyTo,
      subject: input.subject,
      html,
      text,
      tags: input.tags ?? [],
    });

    if (resp.error) {
      const error = resp.error.message ?? 'Unknown Resend error';
      const errorCode =
        (resp.error as { name?: string }).name ?? null;
      await writeEmailLog(logRef, {
        ...baseLog,
        status: 'failed',
        resendId: null,
        error,
        errorCode,
        sentAt: null,
      });
      logger.error('email.send.failed', { siteId: input.siteId ?? undefined, error });
      return { ok: false, error, logId: logRef.id };
    }

    const resendId = resp.data?.id ?? null;
    await writeEmailLog(logRef, {
      ...baseLog,
      status: 'sent',
      resendId,
      error: null,
      errorCode: null,
      sentAt: new Date(),
    });
    return { ok: true, id: resendId ?? '', logId: logRef.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await writeEmailLog(logRef, {
      ...baseLog,
      status: 'failed',
      resendId: null,
      error,
      errorCode: 'exception',
      sentAt: null,
    });
    logger.error('email.send.exception', { siteId: input.siteId ?? undefined, error });
    return { ok: false, error, logId: logRef.id };
  }
}

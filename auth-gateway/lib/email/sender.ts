import { logger } from '@/lib/logger';
import { getEmailContext } from './context';
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
    subject: input.templateAlias,
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
    logger.info('email.dev.blocked', { to: toList.join(','), templateAlias: input.templateAlias });
    return { ok: true, id: 'dev_blocked', logId: logRef.id };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not set');

    const body: Record<string, unknown> = {
      from: fromHeader,
      to: toList,
      template: {
        id: input.templateAlias,
        variables: {
          ...input.variables,
          businessName: context.brand.businessName,
          logoUrl: context.brand.logoUrl ?? '',
          primaryColor: context.brand.primaryColor ?? '',
          siteUrl: context.brand.siteUrl,
        },
      },
      tags: input.tags ?? [],
    };
    if (ccList.length) body.cc = ccList;
    if (bccList.length) body.bcc = bccList;
    if (replyTo) body.reply_to = replyTo;

    const httpResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const respJson = await httpResp.json() as { id?: string; message?: string; name?: string };
    const resp = {
      data: httpResp.ok ? { id: respJson.id ?? null } : null,
      error: httpResp.ok ? null : { message: respJson.message ?? 'Unknown error', name: respJson.name },
    };

    if (resp.error) {
      const error = resp.error.message ?? 'Unknown Resend error';
      const errorCode = (resp.error as { name?: string }).name ?? null;
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

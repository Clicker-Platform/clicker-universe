'use server';

import { headers } from 'next/headers';
import { logger } from '@/lib/logger';
import { createRegistrationRequest, validatePromoCode } from './api-server';
import { submitLimiter } from './rate-limit';
import { registrationInputSchema, type RegistrationInput } from './schema';

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'unknown';
}

export async function submitRegistration(input: RegistrationInput): Promise<SubmitResult> {
  const ip = await getClientIp();
  if (!submitLimiter.check(ip)) {
    return { ok: false, error: 'Too many requests. Please try again later.' };
  }

  const parsed = registrationInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: 'Invalid input', fieldErrors };
  }

  const data = parsed.data;
  let promoCodeValidAtSubmit = data.promoCodeValidAtSubmit;
  if (data.promoCode) {
    try {
      const result = await validatePromoCode(data.promoCode);
      promoCodeValidAtSubmit = result.valid;
    } catch (error) {
      logger.error('registration.submit.promoRevalidate.failed', { error });
      promoCodeValidAtSubmit = false;
    }
  }

  try {
    const id = await createRegistrationRequest({
      ...data,
      promoCodeValidAtSubmit,
    });

    // Fire-and-forget email notifications (failure tidak menggagalkan submit)
    void sendRegistrationEmails(id, data).catch((err) => {
      logger.error('registration.submit.emailHook.failed', { error: err });
    });

    return { ok: true, id };
  } catch (error) {
    logger.error('registration.submit.failed', { error });
    return { ok: false, error: 'Failed to submit registration' };
  }
}

async function sendRegistrationEmails(
  id: string,
  data: RegistrationInput
): Promise<void> {
  const { sendEmail } = await import('@/lib/email/sender');
  const aliases = await (await import('@/lib/email/config')).getTemplateAliases();
  const { writeEvent } = await import('./event-log');

  async function trySend(
    label: 'confirmation' | 'admin_notif',
    payload: Parameters<typeof sendEmail>[0]
  ) {
    try {
      const result = await sendEmail(payload);
      if (!result.ok) {
        await writeEvent({
          type: 'email.failed',
          registrationId: id,
          payload: { type: label, error: result.error },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await writeEvent({
        type: 'email.failed',
        registrationId: id,
        payload: { type: label, error: msg },
      });
    }
  }

  const tasks: Promise<unknown>[] = [];

  // Email 1: konfirmasi ke pendaftar
  tasks.push(
    trySend('confirmation', {
      to: data.email,
      siteId: 'platform',
      templateAlias: aliases.regConfirmation,
      variables: {
        name: data.name,
        businessName: data.businessName,
        reviewSla: '3 jam',
      },
      tags: [{ name: 'registrationId', value: id }],
    })
  );

  // Email 2: notif ke admin (kalau ENV diset)
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const backyardUrl = process.env.NEXT_PUBLIC_BACKYARD_URL ?? 'http://localhost:3013';
    tasks.push(
      trySend('admin_notif', {
        to: adminEmail,
        siteId: 'platform',
        templateAlias: aliases.regAdminNotif,
        variables: {
          businessName: data.businessName,
          name: data.name,
          email: data.email,
          phone: data.phone,
          city: data.city,
          bundle: data.bundle ?? '',
          modules: (data.modules ?? []).join(', '),
          promoCode: data.promoCode ?? '',
          customRequest: data.customRequest ?? '',
          backyardUrl: `${backyardUrl}/registrations/${id}`,
        },
        tags: [{ name: 'registrationId', value: id }],
      })
    );
  }

  await Promise.allSettled(tasks);
}

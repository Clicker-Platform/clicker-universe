import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const DEFAULTS = {
  templates: {
    passwordReset:    'password-reset',
    emailVerification:'email-verification',
    formSubmission:   'form-submission',
    systemAlert:      'system-alert',
    regConfirmation:  'registration-confirmation',
    regAdminNotif:    'registration-admin-notif',
  },
  sender: {
    domain:    'clicker.id',
    localPart: 'noreply',
    fromName:  'Clicker Platform',
  },
};

export async function GET() {
  try {
    const doc = await adminDb.doc('platform/email/config').get();
    if (doc.exists) {
      const data = doc.data()!;
      return NextResponse.json({
        templates: { ...DEFAULTS.templates, ...data.templates },
        sender: { ...DEFAULTS.sender, ...data.sender },
      });
    }
    return NextResponse.json(DEFAULTS);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

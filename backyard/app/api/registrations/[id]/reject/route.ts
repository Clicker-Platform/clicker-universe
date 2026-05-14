import { NextRequest, NextResponse } from 'next/server';
import { setStatus, getRegistration } from '@/lib/registrations/api';
import { sendEmail } from '@/lib/email/send';
import { writeEvent } from '@/lib/registrations/event-log';
import { requireSuperadmin } from '@/lib/require-superadmin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { id } = await params;
    const { reason } = await req.json();

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'Reason wajib diisi' }, { status: 400 });
    }

    const reg = await getRegistration(id);
    if (!reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    await setStatus(id, 'rejected', { rejectionReason: reason });

    const emailResult = await sendEmail({
      to: reg.email,
      templateAlias: process.env.RESEND_TEMPLATE_REG_REJECTED ?? 'registration-rejected',
      variables: {
        name: reg.name,
        businessName: reg.businessName,
        reason,
      },
      registrationId: id,
    });

    if (!emailResult.ok) {
      await writeEvent({
        type: 'email.failed',
        registrationId: id,
        payload: { type: 'rejected', error: emailResult.error },
      });
    }

    await writeEvent({
      type: 'registration.rejected',
      registrationId: id,
      payload: { reason, emailSent: emailResult.ok },
    });

    return NextResponse.json({ success: true, emailSent: emailResult.ok });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

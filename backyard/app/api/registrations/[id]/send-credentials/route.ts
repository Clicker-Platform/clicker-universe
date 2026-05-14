import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendEmail } from '@/lib/email/send';
import { writeEvent } from '@/lib/registrations/event-log';
import { REGISTRATION_REQUESTS_COLLECTION } from '@/lib/registrations/constants';
import { requireSuperadmin } from '@/lib/require-superadmin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { id } = await params;
    const ref = doc(db, REGISTRATION_REQUESTS_COLLECTION, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const data = snap.data();
    if (data.status !== 'activated') {
      return NextResponse.json({ error: 'Registrasi belum di-activate' }, { status: 400 });
    }
    if (data.credentialsSent === true) {
      return NextResponse.json({ error: 'Kredensial sudah pernah dikirim' }, { status: 409 });
    }
    if (!data.tempPassword) {
      return NextResponse.json({ error: 'Password tidak tersedia (mungkin sudah dihapus)' }, { status: 400 });
    }
    if (!data.activatedSiteId || !data.email) {
      return NextResponse.json({ error: 'Data registrasi tidak lengkap' }, { status: 400 });
    }

    const slug = data.activatedSiteId as string;
    const tenantUrlTemplate = process.env.NEXT_PUBLIC_TENANT_URL_TEMPLATE ?? 'https://{slug}.clicker.id';
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth.clicker.id';

    const result = await sendEmail({
      to: data.email as string,
      templateAlias: process.env.RESEND_TEMPLATE_REG_ACTIVATED ?? 'registration-activated',
      variables: {
        name: (data.name as string) ?? '',
        businessName: (data.businessName as string) ?? '',
        loginEmail: data.email as string,
        password: data.tempPassword as string,
        slug,
        authUrl,
        tenantUrl: tenantUrlTemplate.replace('{slug}', slug),
      },
      registrationId: id,
    });

    if (!result.ok) {
      await writeEvent({
        type: 'email.failed',
        registrationId: id,
        payload: { type: 'credentials', error: result.error },
      });
      return NextResponse.json({ error: `Gagal kirim email: ${result.error}` }, { status: 500 });
    }

    await updateDoc(ref, {
      credentialsSent: true,
      credentialsSentAt: serverTimestamp(),
      tempPassword: null,
      updatedAt: serverTimestamp(),
    });

    await writeEvent({
      type: 'registration.credentials_sent',
      registrationId: id,
      payload: { to: data.email, slug },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

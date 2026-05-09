import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getRegistration, setStatus } from '@/lib/registrations/api';
import { commitRegistrationPromo } from '@/lib/promo/api';
import { writeEvent } from '@/lib/registrations/event-log';
import { REGISTRATION_REQUESTS_COLLECTION } from '@/lib/registrations/constants';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { siteId, tempPassword } = await req.json();

    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const reg = await getRegistration(id);
    if (!reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // 1. Update status registrasi
    await setStatus(id, 'activated', { activatedSiteId: siteId });

    // 2. Simpan tempPassword (jika dikirim)
    if (tempPassword) {
      const ref = doc(db, REGISTRATION_REQUESTS_COLLECTION, id);
      await updateDoc(ref, { tempPassword, updatedAt: serverTimestamp() });
    }

    // 3. Promo commit (best-effort)
    if (reg.promoCode) {
      try {
        await commitRegistrationPromo(siteId, reg.promoCode);
      } catch (promoErr: unknown) {
        const msg = promoErr instanceof Error ? promoErr.message : 'Unknown error';
        await writeEvent({
          type: 'promo.commit.failed',
          registrationId: id,
          payload: { promoCode: reg.promoCode, error: msg },
        });
      }
    }

    // 4. Event log: activated
    await writeEvent({
      type: 'registration.activated',
      registrationId: id,
      payload: { siteId, hasPromo: !!reg.promoCode },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

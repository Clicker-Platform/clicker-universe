import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_PRODUCTS, DOC_SETTINGS, publicRoutes } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct, DigitalGoodsSettings } from '@/lib/modules/digital_goods/types';
import { buyerNeedsOnboarding } from '@/lib/modules/digital_goods/server-api';
import { CheckoutClient } from './CheckoutClient';

export const revalidate = 0;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}) {
  const { tenant, slug } = await params;
  const siteId = tenant;
  const routes = publicRoutes(tenant);

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  console.log('[CHECKOUT] cookie present=', !!sessionCookie, 'len=', sessionCookie?.length ?? 0, 'first40=', sessionCookie?.slice(0,40), 'last20=', sessionCookie?.slice(-20));
  if (!sessionCookie) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.checkout(slug))}`);
  }

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    console.log('[CHECKOUT] session valid uid=', decoded.uid);
  } catch (e) {
    console.log('[CHECKOUT] verifySessionCookie threw:', (e as Error).message);
    redirect(`${routes.login}?next=${encodeURIComponent(routes.checkout(slug))}`);
  }

  if (await buyerNeedsOnboarding(siteId, decoded!.uid)) {
    redirect(`${routes.onboarding}?next=${encodeURIComponent(routes.checkout(slug))}`);
  }

  const productSnap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_PRODUCTS}`)
    .where('slug', '==', slug)
    .where('status', '==', 'published')
    .limit(1)
    .get();
  if (productSnap.empty) notFound();
  const product = { id: productSnap.docs[0].id, ...productSnap.docs[0].data() } as DigitalProduct;

  const settingsSnap = await adminDb.doc(`sites/${siteId}/${DOC_SETTINGS}`).get();
  const settings = settingsSnap.exists ? settingsSnap.data() as DigitalGoodsSettings : null;

  if (!settings || !settings.bankName) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900">Checkout unavailable</h1>
          <p className="text-gray-600 mt-2">The store owner has not configured payment details yet.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h1>
        <CheckoutClient
          tenant={tenant}
          siteId={siteId}
          productId={product.id}
          productTitle={product.title}
          amount={product.price}
          buyerEmail={decoded.email ?? ''}
          bankName={settings.bankName}
          accountNumber={settings.accountNumber}
          accountName={settings.accountName}
          qrisImageUrl={settings.qrisImageUrl}
        />
      </div>
    </main>
  );
}

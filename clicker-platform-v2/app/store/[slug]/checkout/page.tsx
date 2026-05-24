import { headers, cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_PRODUCTS, DOC_SETTINGS, PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct, DigitalGoodsSettings } from '@/lib/modules/digital_goods/types';
import { CheckoutClient } from './CheckoutClient';

export const revalidate = 0;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) notFound();

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) {
    redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.store}/${slug}/checkout`)}`);
  }

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.store}/${slug}/checkout`)}`);
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

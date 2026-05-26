import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_ORDERS, publicRoutes } from '@/lib/modules/digital_goods/constants';
import type { DigitalOrder } from '@/lib/modules/digital_goods/types';
import { OrderStatusClient } from './OrderStatusClient';

export const revalidate = 0;

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ tenant: string; orderId: string }>;
}) {
  const { tenant, orderId } = await params;
  const siteId = tenant;
  const routes = publicRoutes(tenant);

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`${routes.login}?next=${encodeURIComponent(routes.orderStatus(orderId))}`);

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { redirect(`${routes.login}?next=${encodeURIComponent(routes.orderStatus(orderId))}`); }

  const snap = await adminDb.doc(`sites/${siteId}/${COLLECTION_ORDERS}/${orderId}`).get();
  if (!snap.exists) notFound();
  const raw = snap.data() as DigitalOrder;
  if (raw.buyerId !== decoded!.uid) notFound();
  const order = JSON.parse(JSON.stringify({ ...raw, id: snap.id })) as DigitalOrder;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Order #{order.id.slice(0, 8)}</h1>
        <OrderStatusClient tenant={tenant} siteId={siteId} orderId={order.id} initialOrder={order} />
      </div>
    </main>
  );
}

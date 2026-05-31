'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccountAuth } from '@/components/account/AccountAuthProvider';
import { getOrder } from '@/lib/modules/digital_goods/orders';
import type { DigitalOrder } from '@/lib/modules/digital_goods/types';
import { OrderStatusClient } from './OrderStatusClient';

export default function AccountOrderStatusPage() {
  const params = useParams();
  const tenant = typeof params.tenant === 'string' ? params.tenant : '';
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';

  const { user, loading } = useAccountAuth();
  const [order, setOrder] = useState<DigitalOrder | null>(null);
  const [orderNotFound, setOrderNotFound] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || !tenant) return;
    let cancelled = false;

    (async () => {
      try {
        const o = await getOrder(tenant, orderId);
        if (cancelled) return;

        // Entitlement check: missing order or owned by another user → not found.
        if (!o || o.buyerId !== user.uid) {
          setOrderNotFound(true);
          setReady(true);
          return;
        }

        setOrder(o);
        setReady(true);
      } catch {
        // Firestore read failure (network/permissions) → degrade to not-found
        // instead of hanging on a blank screen.
        if (cancelled) return;
        setOrderNotFound(true);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, tenant, orderId]);

  if (loading || !user || !ready) return null;

  if (orderNotFound || !order) {
    return (
      <div>
        <p className="text-gray-500 mt-8">Pesanan tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight mb-6">Order #{order.id.slice(0, 8)}</h1>
      <OrderStatusClient tenant={tenant} siteId={tenant} orderId={order.id} initialOrder={order} />
    </div>
  );
}

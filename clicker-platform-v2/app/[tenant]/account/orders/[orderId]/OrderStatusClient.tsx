'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { subscribeOrder } from '@/lib/modules/digital_goods/orders';
import type { DigitalOrder } from '@/lib/modules/digital_goods/types';

interface Props { tenant: string; siteId: string; orderId: string; initialOrder: DigitalOrder; }

export function OrderStatusClient({ tenant, siteId, orderId, initialOrder }: Props) {
  const [order, setOrder] = useState<DigitalOrder>(initialOrder);
  const [libraryEntryId, setLibraryEntryId] = useState<string | null>(null);
  useEffect(() => {
    const unsub = subscribeOrder(siteId, orderId, o => { if (o) setOrder(o); });
    return () => unsub();
  }, [siteId, orderId]);
  useEffect(() => {
    if (order.status !== 'paid') return;
    fetch(`/api/digital-goods/lookup-library?orderId=${orderId}`, { headers: { 'x-site-id': siteId } })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.libraryEntryId && setLibraryEntryId(d.libraryEntryId))
      .catch(() => {});
  }, [order.status, orderId, siteId]);
  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">Status</p>
        <p className="text-lg font-bold mt-1">
          <span className={`px-3 py-1 rounded ${order.status === 'paid' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span>
        </p>
        {order.status === 'awaiting_confirmation' && (<p className="text-sm text-gray-600 mt-3">Kami akan kirim email saat pesanan dikonfirmasi.</p>)}
        {order.status === 'paid' && libraryEntryId && (
          <Link href={`/${tenant}/account/library/${libraryEntryId}`} className="inline-block mt-3 bg-studio-blue text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-studio-blue/90">Lihat di Library →</Link>
        )}
      </section>
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">Product</p>
        <p className="text-sm font-medium text-gray-900 mt-1">{order.productSnapshot.title}</p>
        <p className="text-lg font-bold mt-2">Rp {order.amount.toLocaleString('id-ID')}</p>
      </section>
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">Bank</p>
        <p className="text-sm text-gray-700 mt-1">{order.paymentInstructions.bankName} · {order.paymentInstructions.accountNumber}</p>
        <p className="text-sm text-gray-700">a/n {order.paymentInstructions.accountName}</p>
      </section>
    </div>
  );
}

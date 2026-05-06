'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function PosWidget({ siteId }: Props) {
  const [revenue, setRevenue] = useState<number | null>(null);
  const [orders, setOrders] = useState<number | null>(null);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    getDocs(query(
      collection(db, 'sites', siteId, 'modules', 'byod_pos', 'orders'),
      where('status', '==', 'completed'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay))
    )).then(snap => {
      let total = 0;
      snap.forEach(d => { total += d.data().total ?? 0; });
      setRevenue(total);
      setOrders(snap.size);
    }).catch(err => console.error('PosWidget query failed', err));
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {revenue === null ? '—' : `Rp ${revenue.toLocaleString('id-ID')}`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {orders === null ? '' : `${orders} orders · today`}
      </p>
    </>
  );
}

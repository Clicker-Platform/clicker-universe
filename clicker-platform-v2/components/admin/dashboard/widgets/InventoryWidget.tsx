'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function InventoryWidget({ siteId }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [lowStock, setLowStock] = useState<number | null>(null);

  useEffect(() => {
    const col = collection(db, 'sites', siteId, 'inventory_items');
    Promise.all([
      getCountFromServer(col),
      getCountFromServer(query(col, where('lowStock', '==', true))),
    ]).then(([totalSnap, lowSnap]) => {
      setTotal(totalSnap.data().count);
      setLowStock(lowSnap.data().count);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {total === null ? '—' : `${total} items`}
      </p>
      <p className={`text-xs font-medium ${lowStock ? 'text-red-500' : 'text-gray-500 dark:text-neutral-400'}`}>
        {lowStock === null ? '' : lowStock > 0 ? `⚠ ${lowStock} low stock` : 'Stock OK'}
      </p>
    </>
  );
}

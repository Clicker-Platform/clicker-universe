'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function InventoryWidget({ siteId }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [lowStock, setLowStock] = useState<number | null>(null);

  useEffect(() => {
    const col = collection(db, 'sites', siteId, 'modules', 'inventory', 'items');
    // Only fetch active (non-archived) items — avoids full collection scan
    getDocs(query(col, where('archivedAt', '==', null))).then(snap => {
      const low = snap.docs.filter(d => {
        const data = d.data();
        return typeof data.currentStock === 'number'
          && typeof data.lowStockThreshold === 'number'
          && data.currentStock <= data.lowStockThreshold;
      }).length;
      setTotal(snap.size);
      setLowStock(low);
    }).catch(() => {
      // archivedAt field may not exist on older items — fall back to unfiltered count
      getDocs(col).then(snap => {
        const items = snap.docs.filter(d => !d.data().archivedAt);
        const low = items.filter(d => {
          const data = d.data();
          return typeof data.currentStock === 'number'
            && typeof data.lowStockThreshold === 'number'
            && data.currentStock <= data.lowStockThreshold;
        }).length;
        setTotal(items.length);
        setLowStock(low);
      }).catch(() => { setTotal(0); setLowStock(0); });
    });
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

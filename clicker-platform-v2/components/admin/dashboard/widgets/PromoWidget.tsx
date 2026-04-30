'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function PromoWidget({ siteId }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [expiringSoon, setExpiringSoon] = useState<number | null>(null);

  useEffect(() => {
    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const col = collection(db, 'sites', siteId, 'promos');
    Promise.all([
      getCountFromServer(query(col, where('status', '==', 'active'))),
      getCountFromServer(query(col,
        where('status', '==', 'active'),
        where('endDate', '<=', Timestamp.fromDate(weekFromNow)),
        where('endDate', '>=', Timestamp.fromDate(now))
      )),
    ]).then(([activeSnap, expiringSnap]) => {
      setActive(activeSnap.data().count);
      setExpiringSoon(expiringSnap.data().count);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {active === null ? '—' : `${active} active`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {expiringSoon === null ? '' : `${expiringSoon} expiring this week`}
      </p>
    </>
  );
}

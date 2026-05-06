'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function ServiceRecordsWidget({ siteId }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [unpaid, setUnpaid] = useState<number | null>(null);

  useEffect(() => {
    const col = collection(db, 'sites', siteId, 'modules', 'service_records', 'serviceRecords');
    getDocs(query(col, where('status', '==', 'ACTIVE'))).then(snap => {
      setActive(snap.size);
      setUnpaid(snap.docs.filter(d => d.data().paymentStatus === 'UNPAID').length);
    }).catch(err => console.error('ServiceRecordsWidget query failed', err));
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {active === null ? '—' : `${active} active`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {unpaid === null ? '' : `${unpaid} unpaid`}
      </p>
    </>
  );
}

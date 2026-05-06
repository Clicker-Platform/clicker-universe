'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function ReservationWidget({ siteId }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    getDocs(query(
      collection(db, 'sites', siteId, 'modules', 'reservation', 'bookings'),
      where('startAt', '>=', Timestamp.fromDate(startOfDay))
    )).then(snap => {
      setTotal(snap.size);
      setPending(snap.docs.filter(d => d.data().status === 'pending').length);
    }).catch(err => console.error('ReservationWidget query failed', err));
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {total === null ? '—' : `${total} bookings`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {pending === null ? '' : `${pending} pending confirmation`}
      </p>
    </>
  );
}

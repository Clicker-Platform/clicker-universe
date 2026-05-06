'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function MembershipWidget({ siteId }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [newThisWeek, setNewThisWeek] = useState<number | null>(null);

  useEffect(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const col = collection(db, 'sites', siteId, 'modules', 'membership', 'members');
    Promise.all([
      getCountFromServer(col),
      getCountFromServer(query(col, where('createdAt', '>=', Timestamp.fromDate(weekAgo)))),
    ]).then(([totalSnap, weekSnap]) => {
      setTotal(totalSnap.data().count);
      setNewThisWeek(weekSnap.data().count);
    }).catch(err => console.error('MembershipWidget query failed', err));
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {total === null ? '—' : `${total} members`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {newThisWeek === null ? '' : `+${newThisWeek} new this week`}
      </p>
    </>
  );
}

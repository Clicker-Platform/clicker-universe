'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function ServiceRecordsWidget({ siteId }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [pendingApproval, setPendingApproval] = useState<number | null>(null);

  useEffect(() => {
    const col = collection(db, 'sites', siteId, 'service_records');
    Promise.all([
      getCountFromServer(query(col, where('status', 'in', ['open', 'in_progress']))),
      getCountFromServer(query(col, where('status', '==', 'pending_approval'))),
    ]).then(([openSnap, pendingSnap]) => {
      setOpen(openSnap.data().count);
      setPendingApproval(pendingSnap.data().count);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {open === null ? '—' : `${open} open`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {pendingApproval === null ? '' : `${pendingApproval} pending approval`}
      </p>
    </>
  );
}

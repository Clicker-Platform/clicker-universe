'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function SalesPipelineWidget({ siteId }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [newThisWeek, setNewThisWeek] = useState<number | null>(null);

  useEffect(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const col = collection(db, 'sites', siteId, 'modules', 'sales_pipeline', 'leads');
    Promise.all([
      getCountFromServer(query(col, where('status', 'in', ['new', 'contacted', 'qualified', 'proposal']))),
      getCountFromServer(query(col, where('createdAt', '>=', Timestamp.fromDate(weekAgo)))),
    ]).then(([openSnap, weekSnap]) => {
      setOpen(openSnap.data().count);
      setNewThisWeek(weekSnap.data().count);
    }).catch(err => console.error('SalesPipelineWidget query failed', err));
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {open === null ? '—' : `${open} open leads`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {newThisWeek === null ? '' : `+${newThisWeek} new this week`}
      </p>
    </>
  );
}

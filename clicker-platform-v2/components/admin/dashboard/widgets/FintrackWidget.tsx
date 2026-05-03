'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function FintrackWidget({ siteId }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [entries, setEntries] = useState<number | null>(null);

  useEffect(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    getDocs(query(
      collection(db, 'sites', siteId, 'modules', 'fintrack', 'entries'),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
    )).then(snap => {
      let bal = 0;
      snap.forEach(d => {
        const data = d.data();
        const amt = data.jumlah ?? 0;
        bal += data.jenis === 'pemasukan' ? amt : -amt;
      });
      setBalance(bal);
      setEntries(snap.size);
    }).catch(err => console.error('FintrackWidget query failed', err));
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {balance === null ? '—' : `Rp ${balance.toLocaleString('id-ID')}`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {entries === null ? '' : `${entries} entries this month`}
      </p>
    </>
  );
}

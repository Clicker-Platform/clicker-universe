'use client';

import { useState, useEffect } from 'react';
import { useSite } from '@/lib/site-context';
import { subscribeCreditBalance } from '../api';

export function useCredits() {
  const { siteId } = useSite();
  const [balance, setBalance] = useState<number>(0);
  const [lifetimeUsed, setLifetimeUsed] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    const unsub = subscribeCreditBalance(siteId, (bal, used) => {
      setBalance(bal);
      setLifetimeUsed(used);
      setLoading(false);
    });
    return unsub;
  }, [siteId]);

  return { balance, lifetimeUsed, loading };
}

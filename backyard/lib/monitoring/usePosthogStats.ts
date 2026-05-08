'use client';

import { useEffect, useState, useCallback } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { PosthogStats } from './types';

const monitoringFunctions = getFunctions(app, 'asia-southeast1');

export function usePosthogStats() {
  const [data, setData] = useState<PosthogStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const callable = httpsCallable<unknown, PosthogStats>(monitoringFunctions, 'getPosthogStats');
      const resp = await callable({});
      setData(resp.data);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, error, loading, updatedAt, refresh };
}

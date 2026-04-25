'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface PlatformLog {
  id: string;
  level: 'error' | 'warn';
  event: string;
  service: string;
  siteId: string;
  message?: string;
  meta?: Record<string, unknown>;
  ts: { toDate: () => Date };
  ttl: { toDate: () => Date };
  count?: number;
}

interface UseMonitoringLogsOptions {
  siteId?: string;
  level?: 'error' | 'warn';
  event?: string;
  maxItems?: number;
}

export function useMonitoringLogs(options: UseMonitoringLogsOptions = {}) {
  const { siteId, level, event, maxItems = 50 } = options;
  const [logs, setLogs] = useState<PlatformLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const col = collection(db, 'platform_logs');
    const constraints: QueryConstraint[] = [
      orderBy('ts', 'desc'),
      limit(maxItems),
    ];

    if (siteId) constraints.push(where('siteId', '==', siteId));
    if (level) constraints.push(where('level', '==', level));
    if (event) constraints.push(where('event', '==', event));

    const q = query(col, ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlatformLog));
        setLogs(items);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [siteId, level, event, maxItems]);

  return { logs, loading, error };
}

export function useUnreadLogCount(lastSeenAt: Date | null): number {
  const { logs } = useMonitoringLogs({ level: 'error', maxItems: 100 });
  if (!lastSeenAt) return logs.length;
  return logs.filter((l) => l.ts.toDate() > lastSeenAt).length;
}

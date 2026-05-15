'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, RefreshCw } from 'lucide-react';

interface EventDoc {
  id: string;
  type: string;
  level: 'info' | 'error';
  registrationId: string;
  payload: Record<string, unknown>;
  createdAt: Timestamp | null;
}

const LABELS: Record<string, string> = {
  'registration.activated': 'Tenant aktivasi',
  'registration.credentials_sent': 'Kredensial dikirim',
  'registration.rejected': 'Registrasi ditolak',
  'email.failed': 'Email gagal kirim',
  'promo.commit.failed': 'Promo commit gagal',
};

type LevelFilter = 'all' | 'info' | 'error';

function formatTime(ts: Timestamp | null): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('id-ID');
  } catch {
    return '—';
  }
}

function summarize(type: string, payload: Record<string, unknown>): string {
  if (type === 'email.failed') return `${payload.type ?? 'email'}: ${payload.error ?? '—'}`;
  if (type === 'promo.commit.failed') return `${payload.promoCode ?? '?'}: ${payload.error ?? '—'}`;
  if (type === 'registration.activated') return `Site: ${payload.siteId ?? '?'}`;
  if (type === 'registration.credentials_sent') return `→ ${payload.to ?? '?'}`;
  if (type === 'registration.rejected') return typeof payload.reason === 'string' ? payload.reason : '';
  return '';
}

export function RegistrationsTab() {
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const constraints =
        levelFilter === 'all'
          ? [orderBy('createdAt', 'desc'), limit(100)]
          : [where('level', '==', levelFilter), orderBy('createdAt', 'desc'), limit(100)];

      const q = query(collection(db, 'registrationEvents'), ...constraints);
      const snap = await getDocs(q);
      setEvents(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: (data.type as string) ?? '',
            level: (data.level as 'info' | 'error') ?? 'info',
            registrationId: (data.registrationId as string) ?? '',
            payload: (data.payload as Record<string, unknown>) ?? {},
            createdAt: (data.createdAt as Timestamp | null) ?? null,
          };
        })
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [levelFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const errorCount = events.filter((e) => e.level === 'error').length;
  const infoCount = events.length - errorCount;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
          className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
        >
          <option value="all">All levels</option>
          <option value="info">Info only</option>
          <option value="error">Error only</option>
        </select>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium hover:border-brand-dark"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <div className="flex-1" />
        <span className="text-sm text-gray-500">
          <span className="text-green-600 font-bold">{infoCount}</span> info ·{' '}
          <span className="text-red-600 font-bold">{errorCount}</span> error
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Memuat event log...
        </div>
      ) : error ? (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-bold">⚠ Gagal memuat</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : events.length === 0 ? (
        <p className="text-center py-12 text-gray-400">Belum ada event log.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {events.map((evt) => {
            const label = LABELS[evt.type] ?? evt.type;
            const summary = summarize(evt.type, evt.payload);
            const dot = evt.level === 'error' ? 'bg-red-500' : 'bg-green-500';
            return (
              <li key={evt.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-bold text-brand-dark">{label}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatTime(evt.createdAt)}
                    </span>
                  </div>
                  {summary && (
                    <p className="text-xs text-gray-500 mt-0.5 break-words">{summary}</p>
                  )}
                  <Link
                    href={`/registrations/${evt.registrationId}`}
                    className="text-xs text-blue-600 hover:underline mt-0.5 inline-block font-mono"
                  >
                    {evt.registrationId}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

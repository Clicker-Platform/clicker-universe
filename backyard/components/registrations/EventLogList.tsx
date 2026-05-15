'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface EventDoc {
  id: string;
  type: string;
  level: 'info' | 'error';
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

function formatTime(ts: Timestamp | null): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString('id-ID');
  } catch {
    return '—';
  }
}

function summarizePayload(type: string, payload: Record<string, unknown>): string {
  if (type === 'email.failed') {
    return `${payload.type ?? 'email'}: ${payload.error ?? 'unknown'}`;
  }
  if (type === 'promo.commit.failed') {
    return `${payload.promoCode ?? '?'}: ${payload.error ?? 'unknown'}`;
  }
  if (type === 'registration.activated') {
    return `Site: ${payload.siteId ?? '?'}`;
  }
  if (type === 'registration.credentials_sent') {
    return `→ ${payload.to ?? '?'}`;
  }
  if (type === 'registration.rejected') {
    return typeof payload.reason === 'string' ? payload.reason : '';
  }
  return '';
}

export function EventLogList({ registrationId }: { registrationId: string }) {
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'registrationEvents'),
        where('registrationId', '==', registrationId),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const list: EventDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: (data.type as string) ?? '',
          level: (data.level as 'info' | 'error') ?? 'info',
          payload: (data.payload as Record<string, unknown>) ?? {},
          createdAt: (data.createdAt as Timestamp | null) ?? null,
        };
      });
      setEvents(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Memuat event log...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 py-2">
        Gagal memuat event log: {error}
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-sm text-gray-400 py-2">Belum ada event log.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {events.map((evt) => {
        const label = LABELS[evt.type] ?? evt.type;
        const summary = summarizePayload(evt.type, evt.payload);
        const dotColor = evt.level === 'error' ? 'bg-red-500' : 'bg-green-500';
        return (
          <li key={evt.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}

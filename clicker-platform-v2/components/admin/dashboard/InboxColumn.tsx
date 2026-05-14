'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Mail } from 'lucide-react';
import type { Submission } from '@/data/mockData';
import { useInboxPanel } from '@/lib/inbox-panel-context';

interface Props {
  siteId: string;
}

type Tab = 'inbox' | 'new' | 'read';

const PREVIEW_LIMIT = 10;

function derivePreview(data: Record<string, any> | undefined): string {
  if (!data) return '';
  for (const v of Object.values(data)) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return '';
}

function deriveSender(data: Record<string, any> | undefined): string {
  if (!data) return 'Anonymous';
  for (const key of ['name', 'fullName', 'contactName', 'email']) {
    const v = data[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return 'Anonymous';
}

function formatRelative(ts?: Timestamp | { toDate?: () => Date }): string {
  if (!ts) return '';
  const date = typeof (ts as any).toDate === 'function' ? (ts as any).toDate() : new Date(ts as any);
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function InboxColumn({ siteId }: Props) {
  const { open } = useInboxPanel();
  const [items, setItems] = useState<Submission[]>([]);
  const [tab, setTab] = useState<Tab>('inbox');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const q = query(
      collection(db, 'sites', siteId, 'inbox'),
      orderBy('submittedAt', 'desc'),
      limit(PREVIEW_LIMIT),
    );
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
      setLoading(false);
    });
    return () => unsub();
  }, [siteId]);

  const filtered = useMemo(() => {
    if (tab === 'new') return items.filter(s => s.status === 'new');
    if (tab === 'read') return items.filter(s => s.status === 'read');
    return items.filter(s => s.status !== 'archived');
  }, [items, tab]);

  const counts = useMemo(
    () => ({
      inbox: items.filter(s => s.status !== 'archived').length,
      new: items.filter(s => s.status === 'new').length,
      read: items.filter(s => s.status === 'read').length,
    }),
    [items],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-4 h-4 text-gray-500" />
        <h2 className="font-semibold text-gray-800 dark:text-neutral-100">Inbox</h2>
        <span className="ml-auto text-xs bg-gray-100 dark:bg-neutral-800 rounded-full px-2 py-0.5 text-gray-700 dark:text-neutral-300">
          {counts.inbox}
        </span>
      </div>

      <div className="flex gap-1 mb-3 text-xs">
        {(['inbox', 'new', 'read'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              tab === t
                ? 'bg-gray-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} {counts[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map(i => (
            <li key={i} className="h-14 rounded bg-gray-100 dark:bg-neutral-800 animate-pulse" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="py-10 flex flex-col items-center text-gray-400 dark:text-neutral-500 text-sm">
          <Mail className="w-8 h-8 mb-2" strokeWidth={1.5} />
          <p>No submissions yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
          {filtered.map(s => {
            const sender = deriveSender(s.data);
            const preview = derivePreview(s.data);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => open({ submissionId: s.id })}
                  className="w-full text-left block py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-800/50 -mx-2 px-2 rounded"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate">
                    {sender}
                    {s.formTitle && (
                      <span className="text-gray-400 dark:text-neutral-500 font-normal"> — {s.formTitle}</span>
                    )}
                  </p>
                  {preview && (
                    <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{preview}</p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">
                    {formatRelative(s.submittedAt)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => open()}
        className="block w-full mt-3 text-center text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        View all in Inbox →
      </button>
    </div>
  );
}

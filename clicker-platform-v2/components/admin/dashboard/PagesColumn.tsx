'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FileText, Plus, Square } from 'lucide-react';

interface Props {
  siteId: string;
  baseUrl: string;
}

interface PageDoc {
  id: string;
  title?: string;
  updatedAt?: Timestamp;
}

const PALETTE = [
  'bg-blue-100 dark:bg-blue-900/30',
  'bg-pink-100 dark:bg-pink-900/30',
  'bg-yellow-100 dark:bg-yellow-900/30',
  'bg-green-100 dark:bg-green-900/30',
  'bg-purple-100 dark:bg-purple-900/30',
  'bg-orange-100 dark:bg-orange-900/30',
];

export function pickThumbnailColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function PagesColumn({ siteId, baseUrl }: Props) {
  const [pages, setPages] = useState<PageDoc[]>([]);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const q = query(
      collection(db, 'sites', siteId, 'pages'),
      orderBy('updatedAt', 'desc'),
      limit(7),
    );
    const unsub = onSnapshot(q, snap => {
      setPages(snap.docs.slice(0, 6).map(d => ({ id: d.id, ...(d.data() as Omit<PageDoc, 'id'>) })));
      setHasOverflow(snap.size > 6);
      setLoading(false);
    });
    return () => unsub();
  }, [siteId]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Square className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800 dark:text-neutral-100">Pages</h2>
        </div>
        <Link
          href={`${baseUrl}/admin/canvas`}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-neutral-400"
        >
          Canvas Studio →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded bg-gray-100 dark:bg-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <Link
          href={`${baseUrl}/admin/canvas`}
          className="block py-8 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded text-center text-sm text-gray-500 dark:text-neutral-400 hover:border-gray-400"
        >
          <Plus className="w-5 h-5 mx-auto mb-1" />
          Create your first page
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {pages.map(p => (
            <Link
              key={p.id}
              href={`${baseUrl}/admin/canvas?page=${p.id}`}
              className="block border border-gray-200 dark:border-neutral-800 rounded overflow-hidden hover:border-gray-400 transition-colors"
            >
              <div className={`h-14 flex items-center justify-center ${pickThumbnailColor(p.id)}`}>
                <FileText className="w-5 h-5 text-gray-400 dark:text-neutral-500" />
              </div>
              <p className="px-2 py-1.5 text-xs font-medium text-gray-800 dark:text-neutral-200 truncate">
                {p.title ?? 'Untitled'}
              </p>
            </Link>
          ))}
          {hasOverflow ? (
            <Link
              href={`${baseUrl}/admin/canvas`}
              className="block border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded h-[5.5rem] flex items-center justify-center text-xs text-gray-500 hover:border-gray-400"
            >
              View all →
            </Link>
          ) : (
            <Link
              href={`${baseUrl}/admin/canvas`}
              className="block border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded h-[5.5rem] flex items-center justify-center text-gray-400 hover:border-gray-400"
              aria-label="Create new page"
            >
              <Plus className="w-5 h-5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';

interface Page {
  id: string;
  title: string;
  status: 'published' | 'draft';
}

const THUMBNAIL_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
];

interface Props {
  baseUrl: string;
}

export function PagesGrid({ baseUrl }: Props) {
  const { siteId } = useSite();
  const [pages, setPages] = useState<Page[]>([]);

  useEffect(() => {
    if (!siteId) return;
    const unsub = onSnapshot(
      query(collection(db, 'sites', siteId, 'pages'), orderBy('updatedAt', 'desc'), limit(6)),
      snap => {
        setPages(snap.docs.map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          status: d.data().published ? 'published' : 'draft',
        })));
      }
    );
    return () => unsub();
  }, [siteId]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Pages</h2>
        {pages.length > 0 && (
          <Link href={`${baseUrl}/admin/canvas`} className="text-xs text-blue-500 hover:underline">
            View all →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {pages.map((page, i) => (
          <div
            key={page.id}
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden"
          >
            <div className={`h-14 ${THUMBNAIL_COLORS[i % THUMBNAIL_COLORS.length]}`} />
            <div className="p-2.5">
              <p className="font-semibold text-xs text-gray-800 dark:text-neutral-100 truncate mb-1.5">
                {page.title}
              </p>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  page.status === 'published'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {page.status === 'published' ? 'Published' : 'Draft'}
                </span>
                <Link
                  href={`${baseUrl}/admin/canvas?page=${page.id}`}
                  className="text-[10px] text-blue-500 hover:underline"
                >
                  Edit →
                </Link>
              </div>
            </div>
          </div>
        ))}

        <Link
          href={`${baseUrl}/admin/canvas`}
          className="border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-lg flex flex-col items-center justify-center gap-1 min-h-[96px] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <span className="text-xl text-blue-400">+</span>
          <span className="text-xs font-semibold text-blue-500">Create Page</span>
        </Link>
      </div>

      {pages.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-2">
          You haven&apos;t created any pages yet. Start building your site.
        </p>
      )}
    </div>
  );
}

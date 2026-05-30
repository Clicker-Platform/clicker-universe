'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccountAuth } from '@/components/account/AccountAuthProvider';
import { fetchLibrary } from '@/lib/account/providers';
import type { LibraryEntry } from '@/lib/modules/digital_goods/types';
import type { MockLibraryItem } from '@/lib/account/mock/types';
import { LibraryCard } from '@/components/account/LibraryCard';

function toCard(e: LibraryEntry): MockLibraryItem {
  return {
    id: e.id,
    title: e.productSnapshot.title,
    kind: e.productSnapshot.contentKind,
    cover: e.productSnapshot.coverImage,
  };
}

export default function LibraryPage() {
  const params = useParams();
  const tenant = typeof params.tenant === 'string' ? params.tenant : '';

  const { user, loading } = useAccountAuth();
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || !tenant) return;
    let cancelled = false;
    fetchLibrary(tenant, user.uid).then((lib) => {
      if (cancelled) return;
      setLibrary(lib);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user, tenant]);

  if (loading || !user || !ready) return null;

  return (
    <div>
      <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">My Library</h1>

      {library.length === 0 ? (
        <p className="text-gray-500 mt-8">Belum ada produk di library kamu.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5">
          {library.map((e) => (
            <LibraryCard key={e.id} item={toCard(e)} />
          ))}
        </div>
      )}
    </div>
  );
}

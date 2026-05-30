'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Store } from 'lucide-react';
import { useAccountAuth } from '@/components/account/AccountAuthProvider';
import { fetchAccount, fetchSurfaces, fetchLibrary } from '@/lib/account/providers';
import type { Account } from '@/lib/account/types';
import type { AccountNavItem } from '@/lib/account/providers';
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

export default function AccountHome() {
  const params = useParams();
  const tenant = typeof params.tenant === 'string' ? params.tenant : '';
  const storeHref = `/${tenant}/store`;

  const { user, loading } = useAccountAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [surfaces, setSurfaces] = useState<AccountNavItem[]>([]);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || !tenant) return;
    let cancelled = false;
    Promise.all([
      fetchAccount(tenant, user.uid),
      fetchSurfaces(tenant),
      fetchLibrary(tenant, user.uid),
    ]).then(([acc, surf, lib]) => {
      if (cancelled) return;
      setAccount(acc);
      setSurfaces(surf);
      setLibrary(lib);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user, tenant]);

  if (loading || !user || !ready) return null;

  const name = account?.fullName ?? account?.email ?? user.email ?? '';

  if (surfaces.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-3">🪴</div>
        <div className="text-xl font-extrabold text-gray-900">Halo, {name} 👋</div>
        <p className="text-gray-500 mt-2 max-w-xs">
          Belum ada layanan di akun kamu. Jelajahi produk untuk mulai.
        </p>
        <Link
          href={storeHref}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold"
          style={{ background: 'var(--account-accent)', color: 'var(--account-accent-fg)' }}
        >
          Lihat produk <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">
            Halo, {name} 👋
          </h1>
          <p className="text-gray-500 mt-0.5">Semua produk &amp; layanan kamu, di satu tempat.</p>
        </div>
        <Link
          href={storeHref}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-white shadow-sm text-gray-700 hover:bg-gray-50"
        >
          <Store size={16} /> Lihat produk
        </Link>
      </div>

      <h2 className="text-sm font-bold text-gray-900 mt-6 mb-3">My Library</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {library.map((e) => (
          <LibraryCard key={e.id} item={toCard(e)} />
        ))}
      </div>
    </div>
  );
}

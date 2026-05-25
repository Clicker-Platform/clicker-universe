'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { hasLibraryEntryForProduct } from '@/lib/modules/digital_goods/library';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct, LibraryEntry } from '@/lib/modules/digital_goods/types';

interface Props {
  tenant: string;
  siteId: string;
  product: DigitalProduct;
}

export function StoreProductClient({ tenant, siteId, product }: Props) {
  const router = useRouter();
  const routes = publicRoutes(tenant);
  const [user, loadingAuth] = useAuthState(auth);
  const [owned, setOwned] = useState<LibraryEntry | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) { setChecking(false); return; }
    let cancelled = false;
    hasLibraryEntryForProduct(siteId, user.uid, product.id)
      .then(entry => { if (!cancelled) setOwned(entry); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [siteId, user, loadingAuth, product.id]);

  if (checking) {
    return <div className="mt-6 h-12 bg-gray-100 rounded-lg animate-pulse" />;
  }

  if (owned) {
    return (
      <button
        onClick={() => router.push(routes.libraryEntry(owned.id))}
        className="mt-6 w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition"
      >
        Open in Library <ArrowRight size={18} />
      </button>
    );
  }

  function handleBuy() {
    const nextUrl = routes.checkout(product.slug);
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(nextUrl)}`);
    } else {
      router.push(nextUrl);
    }
  }

  return (
    <button
      onClick={handleBuy}
      className="mt-6 w-full bg-studio-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-studio-blue/90 transition active:scale-95"
    >
      Buy Now
    </button>
  );
}

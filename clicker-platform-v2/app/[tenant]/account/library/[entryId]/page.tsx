'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAccountAuth } from '@/components/account/AccountAuthProvider';
import { getLibraryEntry } from '@/lib/modules/digital_goods/library';
import { COLLECTION_PRODUCTS } from '@/lib/modules/digital_goods/constants';
import type { LibraryEntry, DigitalProduct, PdfFile, YouTubeFile } from '@/lib/modules/digital_goods/types';
import { LibraryEntryClient } from './LibraryEntryClient';

export default function AccountLibraryEntryPage() {
  const params = useParams();
  const tenant = typeof params.tenant === 'string' ? params.tenant : '';
  const entryId = typeof params.entryId === 'string' ? params.entryId : '';

  const { user, loading } = useAccountAuth();
  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [pdf, setPdf] = useState<PdfFile | undefined>(undefined);
  const [yt, setYt] = useState<YouTubeFile | undefined>(undefined);
  const [entryNotFound, setEntryNotFound] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || !tenant) return;
    let cancelled = false;

    (async () => {
      const e = await getLibraryEntry(tenant, entryId);
      if (cancelled) return;

      // Entitlement check: missing entry or owned by another user → not found.
      if (!e || e.buyerId !== user.uid) {
        setEntryNotFound(true);
        setReady(true);
        return;
      }

      const psnap = await getDoc(doc(db, 'sites', tenant, COLLECTION_PRODUCTS, e.productId));
      if (cancelled) return;

      // A deleted/missing product = nothing to view → treat as not found.
      if (!psnap.exists()) {
        setEntryNotFound(true);
        setReady(true);
        return;
      }

      const product = psnap.data() as DigitalProduct;
      setEntry(e);
      setPdf(product.files.find((f) => f.kind === 'pdf') as PdfFile | undefined);
      setYt(product.files.find((f) => f.kind === 'youtube') as YouTubeFile | undefined);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, tenant, entryId]);

  if (loading || !user || !ready) return null;

  if (entryNotFound || !entry) {
    return (
      <div>
        <p className="text-gray-500 mt-8">Produk tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div>
      {entry.productSnapshot.coverImage && (
        <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.productSnapshot.coverImage} alt={entry.productSnapshot.title} className="w-full h-full object-cover" />
        </div>
      )}
      <p className="text-xs uppercase tracking-wider text-gray-500">{entry.productSnapshot.contentKind}</p>
      <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight mt-1">{entry.productSnapshot.title}</h1>
      <div className="mt-6">
        <LibraryEntryClient
          siteId={tenant}
          productId={entry.productId}
          pdfStoragePath={pdf?.storagePath ?? null}
          pdfFilename={pdf?.name ?? null}
          youtubeUrl={yt?.url ?? null}
        />
      </div>
    </div>
  );
}

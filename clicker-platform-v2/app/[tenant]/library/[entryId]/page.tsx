import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY, COLLECTION_PRODUCTS, publicRoutes } from '@/lib/modules/digital_goods/constants';
import type { LibraryEntry, DigitalProduct, PdfFile, YouTubeFile } from '@/lib/modules/digital_goods/types';
import { buyerNeedsOnboarding } from '@/lib/modules/digital_goods/server-api';
import { LibraryEntryClient } from './LibraryEntryClient';

export const revalidate = 0;

export default async function LibraryEntryPage({
  params,
}: {
  params: Promise<{ tenant: string; entryId: string }>;
}) {
  const { tenant, entryId } = await params;
  const siteId = tenant;
  const routes = publicRoutes(tenant);

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__buyer_session')?.value;
  if (!sessionCookie) redirect(`${routes.login}?next=${encodeURIComponent(routes.libraryEntry(entryId))}`);

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { redirect(`${routes.login}?next=${encodeURIComponent(routes.libraryEntry(entryId))}`); }

  if (await buyerNeedsOnboarding(siteId, decoded.uid)) {
    redirect(`${routes.onboarding}?next=${encodeURIComponent(routes.libraryEntry(entryId))}`);
  }

  const entrySnap = await adminDb.doc(`sites/${siteId}/${COLLECTION_LIBRARY}/${entryId}`).get();
  if (!entrySnap.exists) notFound();
  const entry = { id: entrySnap.id, ...entrySnap.data() } as LibraryEntry;
  if (entry.buyerId !== decoded.uid) notFound();

  const productSnap = await adminDb.doc(`sites/${siteId}/${COLLECTION_PRODUCTS}/${entry.productId}`).get();
  if (!productSnap.exists) notFound();
  const product = productSnap.data() as DigitalProduct;

  const pdf = product.files.find(f => f.kind === 'pdf') as PdfFile | undefined;
  const yt = product.files.find(f => f.kind === 'youtube') as YouTubeFile | undefined;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden">
        {entry.productSnapshot.coverImage && (
          <div className="aspect-video bg-gray-100">
            <img src={entry.productSnapshot.coverImage} alt={entry.productSnapshot.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500">{entry.productSnapshot.contentKind}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{entry.productSnapshot.title}</h1>

          <div className="mt-6">
            <LibraryEntryClient
              siteId={siteId}
              productId={entry.productId}
              pdfStoragePath={pdf?.storagePath ?? null}
              pdfFilename={pdf?.name ?? null}
              youtubeUrl={yt?.url ?? null}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

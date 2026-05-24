import { headers, cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY, COLLECTION_PRODUCTS, PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { LibraryEntry, DigitalProduct, PdfFile, YouTubeFile } from '@/lib/modules/digital_goods/types';
import { LibraryEntryClient } from './LibraryEntryClient';

export const revalidate = 0;

export default async function LibraryEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) notFound();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.library}/${entryId}`)}`);

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.library}/${entryId}`)}`); }

  const entrySnap = await adminDb.doc(`sites/${siteId}/${COLLECTION_LIBRARY}/${entryId}`).get();
  if (!entrySnap.exists) notFound();
  const entry = { id: entrySnap.id, ...entrySnap.data() } as LibraryEntry;
  if (entry.buyerId !== decoded.uid) notFound();

  // Load the underlying product to access files[]
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

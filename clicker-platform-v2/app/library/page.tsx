import { headers, cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY, PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { LibraryEntry } from '@/lib/modules/digital_goods/types';

export const revalidate = 0;

async function fetchLibrary(siteId: string, uid: string): Promise<LibraryEntry[]> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('buyerId', '==', uid)
    .orderBy('purchasedAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryEntry));
}

export default async function LibraryPage() {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) notFound();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (!sessionCookie) {
    redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(PUBLIC_ROUTES.library)}`);
  }

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(PUBLIC_ROUTES.library)}`); }

  const entries = await fetchLibrary(siteId, decoded.uid);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Library</h1>
          <p className="text-sm text-gray-500 mt-1">Everything you&apos;ve purchased.</p>
        </header>
        {entries.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-600 font-medium mb-2">Your library is empty</p>
            <Link href={PUBLIC_ROUTES.store} className="inline-block bg-studio-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-studio-blue/90">
              Browse Store
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map(e => (
              <Link
                key={e.id}
                href={`${PUBLIC_ROUTES.library}/${e.id}`}
                className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition"
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                  {e.productSnapshot.coverImage
                    ? <img src={`/api/storage-image?path=${encodeURIComponent(e.productSnapshot.coverImage)}`} alt={e.productSnapshot.title} className="w-full h-full object-cover" />
                    : 'Cover'}
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500">{e.productSnapshot.contentKind}</p>
                  <h3 className="font-semibold text-gray-900 mt-1 line-clamp-2">{e.productSnapshot.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

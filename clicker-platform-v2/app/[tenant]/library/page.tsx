import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY, publicRoutes } from '@/lib/modules/digital_goods/constants';
import type { LibraryEntry } from '@/lib/modules/digital_goods/types';
import { buyerNeedsOnboarding } from '@/lib/modules/digital_goods/server-api';

export const revalidate = 0;

async function fetchLibrary(siteId: string, uid: string): Promise<LibraryEntry[]> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('buyerId', '==', uid)
    .orderBy('purchasedAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryEntry));
}

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const siteId = tenant;
  const routes = publicRoutes(tenant);

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (!sessionCookie) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.library)}`);
  }

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { redirect(`${routes.login}?next=${encodeURIComponent(routes.library)}`); }

  if (await buyerNeedsOnboarding(siteId, decoded.uid)) {
    redirect(`${routes.onboarding}?next=${encodeURIComponent(routes.library)}`);
  }

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
            <Link href={routes.store} className="inline-block bg-studio-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-studio-blue/90">
              Browse Store
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map(e => (
              <Link
                key={e.id}
                href={routes.libraryEntry(e.id)}
                className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition"
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                  {e.productSnapshot.coverImage
                    ? <img src={e.productSnapshot.coverImage} alt={e.productSnapshot.title} className="w-full h-full object-cover" />
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

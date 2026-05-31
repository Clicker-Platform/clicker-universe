// Server-side member-surface predicate (admin SDK).
//
// The account dashboard's surface resolver (/api/account/surfaces) runs server-side
// and decides whether to show the "My Library" nav item via memberSurface.hasData.
// It MUST use the admin SDK here: the client-SDK library read in surface.ts is gated
// by the `buyerId == request.auth.uid` Firestore rule, and a server route has no
// authenticated client user — so a client-SDK read there is denied and the Library
// surface silently never appears (even though the data exists).
//
// NO `import 'server-only'` here on purpose: definitions.ts (client-imported) lazily
// `import()`s this module, and a `server-only` guard would break the client build.
// Server-only-ness is enforced by the firebase-admin import (same convention as
// lib/account/server-api.ts).
import { adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY } from './constants';
import type { LibraryEntry } from './types';

export async function libraryHasDataAdmin(siteId: string, uid: string): Promise<boolean> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('buyerId', '==', uid)
    .limit(1)
    .get();
  return !snap.empty;
}

// Server-side library list (admin SDK). Drives the account dashboard "My Library"
// list. Mirrors the client-SDK getLibraryForBuyer query but runs under the trusted
// server session (see /api/digital-goods/library) so it never depends on the
// buyerId==request.auth.uid Firestore rule or on the client SDK's silent-empty
// failure mode when an index is still building.
export async function listLibraryForAccountAdmin(
  siteId: string, uid: string,
): Promise<LibraryEntry[]> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('buyerId', '==', uid)
    .orderBy('purchasedAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryEntry));
}

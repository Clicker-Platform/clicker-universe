import { getLibraryForBuyer } from './library';
import type { MemberSurfaceContext } from '@/lib/modules/types';
import type { LibraryEntry } from './types';

// Client-side library fetch for the account dashboard (home page + LibrarySurface).
// The server-side "has any entries?" predicate that drives the sidebar nav lives in
// surface-admin.ts (admin SDK) — a client-SDK read can't run in the surfaces API route.
export async function getLibraryForAccount(ctx: MemberSurfaceContext): Promise<LibraryEntry[]> {
  return getLibraryForBuyer(ctx.siteId, ctx.uid);
}

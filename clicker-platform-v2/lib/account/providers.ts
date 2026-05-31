import { getAccountClient } from './api';
import type { Account } from './types';
import type { LibraryEntry } from '@/lib/modules/digital_goods/types';

// href = route segment WITHOUT leading slash, e.g. 'library'. AccountSidebar
// builds links as `/${tenant}/account/${href}`, so the bare segment resolves to
// /${tenant}/account/library.
export interface AccountNavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
}

export async function fetchAccount(siteId: string, uid: string): Promise<Account | null> {
  return getAccountClient(siteId, uid);
}

export async function fetchSurfaces(siteId: string): Promise<AccountNavItem[]> {
  const res = await fetch('/api/account/surfaces', { headers: { 'x-site-id': siteId } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: { id: string; label: string; icon: string; route: string }[];
  };
  return (data.items ?? []).map((i) => ({
    id: i.id,
    label: i.label,
    icon: i.icon,
    href: i.route.replace(/^\//, ''),
  }));
}

// Reads the buyer's library via the server route (server-session gated + admin SDK).
// uid is resolved server-side from __account_session; it is intentionally not sent.
export async function fetchLibrary(siteId: string, _uid: string): Promise<LibraryEntry[]> {
  const res = await fetch('/api/digital-goods/library', { headers: { 'x-site-id': siteId } });
  if (!res.ok) return [];
  const data = (await res.json()) as { entries?: LibraryEntry[] };
  return data.entries ?? [];
}

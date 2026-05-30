import { getAccountClient } from './api';
import type { Account } from './types';
import { getLibraryForAccount } from '@/lib/modules/digital_goods/surface';
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

export async function fetchLibrary(siteId: string, uid: string): Promise<LibraryEntry[]> {
  return getLibraryForAccount({ siteId, uid });
}

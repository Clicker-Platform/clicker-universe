'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Menu, X } from 'lucide-react';
import { fetchAccount, fetchSurfaces, type AccountNavItem } from '@/lib/account/providers';
import type { Account } from '@/lib/account/types';
import type { MockTenantBrand } from '@/lib/account/mock/types';
import { resolveAccentVars, DEFAULT_ACCENT_PRESET, type AccentPresetId } from '@/lib/account/accent';
import { useAccountAuth } from './AccountAuthProvider';
import { AccountSidebar } from './AccountSidebar';
import { AccountMenu } from './AccountMenu';
import { NotificationMenu } from './NotificationMenu';

export function AccountShell({
  tenant,
  brand,
  children,
}: {
  tenant: string;
  brand: MockTenantBrand;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const isAuth = pathname.includes('/account/login');

  const { user, loading } = useAccountAuth();

  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<AccountNavItem[]>([]);
  const [preset, setPreset] = useState<AccentPresetId>(DEFAULT_ACCENT_PRESET);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Auth guard: bounce unauthenticated visitors to login (login routes bypass).
  useEffect(() => {
    if (loading || isAuth) return;
    if (!user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/${tenant}/account/login?next=${next}`);
    }
  }, [loading, isAuth, user, pathname, tenant, router]);

  // Load account doc (greeting + initial accent) once we have a user.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchAccount(tenant, user.uid).then((acc) => {
      if (cancelled) return;
      setAccount(acc);
      setPreset(acc?.accentPreset ?? DEFAULT_ACCENT_PRESET);
    });
    return () => {
      cancelled = true;
    };
  }, [user, tenant]);

  // Load visible surfaces (sidebar nav).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchSurfaces(tenant).then((s) => {
      if (!cancelled) setItems(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user, tenant]);

  if (isAuth) return <>{children}</>;

  // While auth resolves (or before redirect fires) keep a minimal, on-brand frame.
  if (loading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#f4f4f6] font-[family-name:var(--font-outfit)]"
        style={resolveAccentVars(preset) as React.CSSProperties}
      >
        <span
          className="w-8 h-8 rounded-full border-2 border-gray-200 animate-spin"
          style={{ borderTopColor: 'var(--member-accent)' }}
        />
      </div>
    );
  }

  const displayName = account?.fullName ?? account?.email ?? user.email ?? '';
  const seg = pathname.split('/account/')[1]?.split('/')[0] ?? '';
  const active = seg === '' ? 'home' : items.find((i) => i.href === seg)?.id ?? 'home';
  const initial = displayName.charAt(0).toUpperCase();
  const member = { fullName: account?.fullName, email: displayName };

  return (
    <div
      className="min-h-screen flex bg-[#f4f4f6] font-[family-name:var(--font-outfit)]"
      style={resolveAccentVars(preset) as React.CSSProperties}
    >
      {/* Desktop: static sidebar column */}
      <div className="hidden md:block w-[260px] shrink-0 border-r border-gray-100">
        <AccountSidebar tenant={tenant} brand={brand} items={items} active={active} />
      </div>

      {/* Mobile: floating rounded panel + backdrop */}
      {navOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="absolute left-4 top-4 w-[240px] max-w-[80%] bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.18)] overflow-hidden">
            <button
              onClick={() => setNavOpen(false)}
              aria-label="Tutup menu"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 z-10"
            >
              <X size={18} />
            </button>
            <AccountSidebar
              tenant={tenant}
              brand={brand}
              items={items}
              active={active}
              onNavigate={() => setNavOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar: hamburger (mobile) on the left, actions pinned right (BMC) */}
        <header className="flex items-center gap-2 px-4 md:px-7 py-4">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Buka menu"
            className="md:hidden w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1" />
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700"
            >
              <Bell size={16} />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white"
                style={{ background: 'var(--member-accent)' }}
              />
            </button>
            {notifOpen && <NotificationMenu onClose={() => setNotifOpen(false)} />}
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white shadow-sm"
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'var(--member-accent)', color: 'var(--member-accent-fg)' }}
              >
                {initial}
              </span>
              <span className="hidden sm:inline text-sm font-medium text-gray-700">{displayName}</span>
            </button>
            {menuOpen && (
              <AccountMenu
                member={member}
                accent={preset}
                onAccentChange={setPreset}
                onClose={() => setMenuOpen(false)}
                onAccount={() => setMenuOpen(false)}
                onLogout={() => setMenuOpen(false)}
              />
            )}
          </div>
        </header>
        {/* Centered, capped-width content column */}
        <div className="mx-auto w-full max-w-3xl px-4 md:px-6 pb-10">{children}</div>
      </main>
    </div>
  );
}

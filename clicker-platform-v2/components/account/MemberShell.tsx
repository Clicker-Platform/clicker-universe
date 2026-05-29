'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { getMockMember, getMockSurfaces } from '@/lib/account/mock/providers';
import type { MockTenantBrand } from '@/lib/account/mock/types';
import { resolveAccentVars, type AccentPresetId } from '@/lib/account/accent';
import { MemberSidebar } from './MemberSidebar';
import { AccountMenu } from './AccountMenu';

export function MemberShell({
  tenant,
  brand,
  children,
}: {
  tenant: string;
  brand: MockTenantBrand;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  const isAuth = pathname.includes('/account/login');

  const member = getMockMember();
  const [preset, setPreset] = useState<AccentPresetId>(member.accentPreset ?? 'coral');
  const [menuOpen, setMenuOpen] = useState(false);

  if (isAuth) return <>{children}</>;

  const items = getMockSurfaces(member);
  const seg = pathname.split('/account/')[1]?.split('/')[0] ?? '';
  const active = seg === '' ? 'home' : items.find((i) => i.href === seg)?.id ?? 'home';
  const initial = (member.fullName ?? member.email).charAt(0).toUpperCase();

  return (
    <div
      className="min-h-screen flex bg-[#f4f4f6]"
      style={resolveAccentVars(preset) as React.CSSProperties}
    >
      <MemberSidebar tenant={tenant} brand={brand} items={items} active={active} />
      <main className="flex-1 flex flex-col">
        {/* Full-width top bar, pinned right (BMC) */}
        <header className="flex justify-end items-center gap-2 px-7 py-4">
          <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700">
            <Bell size={16} />
          </button>
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
              <span className="text-sm font-medium text-gray-700">{member.fullName ?? member.email}</span>
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
        <div className="mx-auto w-full max-w-3xl px-6 pb-10">{children}</div>
      </main>
    </div>
  );
}

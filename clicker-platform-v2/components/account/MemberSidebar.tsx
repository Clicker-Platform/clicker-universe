'use client';

import Link from 'next/link';
import { Home, Library, Box } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MockSurfaceNavItem, MockTenantBrand } from '@/lib/account/mock/types';

const SURFACE_ICONS: Record<string, LucideIcon> = {
  library: Library,
};

function iconFor(key: string): LucideIcon {
  return SURFACE_ICONS[key] ?? Box;
}

interface Props {
  tenant: string;
  brand: MockTenantBrand;
  items: MockSurfaceNavItem[];
  active: string;
  member: { fullName?: string; email: string };
}

export function MemberSidebar({ tenant, brand, items, active, member }: Props) {
  const link = (href: string, label: string, key: string, Icon: LucideIcon) => {
    const on = active === key;
    const path = `/${tenant}/account${href ? `/${href}` : ''}`;
    return (
      <Link
        href={path}
        className="flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-medium transition-colors"
        style={
          on
            ? { background: 'var(--member-accent-soft)', color: '#1a1a1a' }
            : { color: '#4b5563' }
        }
      >
        <Icon size={20} /> {label}
      </Link>
    );
  };

  const initial = (member.fullName ?? member.email).charAt(0).toUpperCase();

  return (
    <aside className="w-[260px] shrink-0 bg-white border-r border-gray-100 px-5 py-6 flex flex-col">
      <div className="mb-8 px-1">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto max-w-[160px] object-contain" />
        ) : (
          <span className="font-extrabold text-gray-900 text-lg">{brand.name}</span>
        )}
      </div>
      <nav className="space-y-1.5">
        {link('', 'Home', 'home', Home)}
        {items.map((it) => link(it.href, it.label, it.id, iconFor(it.icon)))}
      </nav>
      <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--member-accent)', color: 'var(--member-accent-fg)' }}
        >
          {initial}
        </div>
        <span className="text-sm text-gray-700 truncate">{member.fullName ?? member.email}</span>
      </div>
    </aside>
  );
}

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
  onNavigate?: () => void;
}

export function MemberSidebar({ tenant, brand, items, active, onNavigate }: Props) {
  const link = (href: string, label: string, key: string, Icon: LucideIcon) => {
    const on = active === key;
    const path = `/${tenant}/account${href ? `/${href}` : ''}`;
    return (
      <Link
        key={key}
        href={path}
        onClick={onNavigate}
        className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] transition-colors ${on ? 'font-semibold' : 'font-medium'}`}
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

  return (
    <aside className="w-full h-full bg-white px-5 py-6 flex flex-col">
      <div className="mb-8 px-1 flex items-center gap-2.5 min-w-0">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="w-9 h-9 rounded-full object-cover shadow-sm shrink-0"
          />
        ) : (
          <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 shrink-0">
            {brand.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="font-extrabold text-gray-900 text-lg truncate">{brand.name}</span>
      </div>
      <nav className="space-y-1.5">
        {link('', 'Home', 'home', Home)}
        {items.map((it) => link(it.href, it.label, it.id, iconFor(it.icon)))}
      </nav>
    </aside>
  );
}

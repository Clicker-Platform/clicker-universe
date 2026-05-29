'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MockSurfaceNavItem } from '@/lib/account/mock/types';

interface Props {
  tenant: string;
  brand: string;
  items: MockSurfaceNavItem[];
  active: string;
  member: { fullName?: string; email: string };
}

export function MemberSidebar({ tenant, brand, items, active, member }: Props) {
  const link = (href: string, label: string, key: string, Icon?: LucideIcon) => {
    const on = active === key;
    const path = `/${tenant}/account${href ? `/${href}` : ''}`;
    return (
      <Link
        href={path}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
        style={
          on
            ? { background: 'var(--member-accent-soft)', color: 'var(--member-accent)' }
            : { color: '#4b5563' }
        }
      >
        {Icon && <Icon size={16} />} {label}
      </Link>
    );
  };

  const initial = (member.fullName ?? member.email).charAt(0).toUpperCase();

  return (
    <aside className="w-[200px] shrink-0 bg-white border-r border-gray-100 p-4 flex flex-col">
      <div className="font-extrabold text-gray-900 text-base mb-5 px-1">{brand}</div>
      <nav className="space-y-1">
        {link('', 'Home', 'home', Home)}
        {items.map((it) => link(it.href, it.label, it.id))}
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

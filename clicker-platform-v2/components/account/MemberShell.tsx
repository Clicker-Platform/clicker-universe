'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { getMockMember, getMockSurfaces } from '@/lib/account/mock/providers';
import { resolveAccentVars, type AccentPresetId } from '@/lib/account/accent';
import { MemberSidebar } from './MemberSidebar';
import { AccentPicker } from './AccentPicker';

export function MemberShell({ tenant, children }: { tenant: string; children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isAuth = pathname.includes('/account/login');

  const member = getMockMember();
  const [preset, setPreset] = useState<AccentPresetId>(member.accentPreset ?? 'coral');
  const [pickerOpen, setPickerOpen] = useState(false);

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
      <MemberSidebar tenant={tenant} brand="Acme ☕" items={items} active={active} member={member} />
      <main className="flex-1 px-7 py-6 relative">
        <div className="absolute right-7 top-6 flex gap-2 z-20">
          <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700">
            <Bell size={16} />
          </button>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--member-accent)', color: 'var(--member-accent-fg)' }}
          >
            {initial}
          </button>
        </div>
        {pickerOpen && (
          <AccentPicker value={preset} onChange={setPreset} onClose={() => setPickerOpen(false)} />
        )}
        {children}
      </main>
    </div>
  );
}

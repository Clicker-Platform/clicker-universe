'use client';

import { useState } from 'react';
import { User, Palette, LogOut, ChevronLeft } from 'lucide-react';
import { ACCENT_PRESETS, type AccentPresetId } from '@/lib/account/accent';

interface Props {
  member: { fullName?: string; email: string };
  accent: AccentPresetId;
  onAccentChange: (p: AccentPresetId) => void;
  onClose: () => void;
  onAccount: () => void; // 1b: navigate to profile route
  onLogout: () => void; // 1b: real sign-out
}

export function AccountMenu({ member, accent, onAccentChange, onClose, onAccount, onLogout }: Props) {
  const [view, setView] = useState<'menu' | 'prefs'>('menu');

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-12 z-40 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] w-[240px] overflow-hidden">
        {view === 'menu' ? (
          <>
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="font-bold text-gray-900 truncate">{member.fullName ?? 'Akun'}</div>
              <div className="text-xs text-gray-400 truncate">{member.email}</div>
            </div>
            <nav className="p-1.5">
              <button onClick={onAccount} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
                <User size={17} /> Account
              </button>
              <button onClick={() => setView('prefs')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
                <Palette size={17} /> Theme
              </button>
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50">
                <LogOut size={17} /> Logout
              </button>
            </nav>
          </>
        ) : (
          <div className="p-3.5">
            <button onClick={() => setView('menu')} className="flex items-center gap-1 text-xs text-gray-500 mb-3">
              <ChevronLeft size={14} /> Kembali
            </button>
            <div className="font-bold text-gray-900 mb-2.5">Warna tema</div>
            <div className="flex gap-2.5">
              {(Object.keys(ACCENT_PRESETS) as AccentPresetId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => onAccentChange(id)}
                  aria-label={id}
                  className="w-[30px] h-[30px] rounded-full box-border"
                  style={{ background: ACCENT_PRESETS[id].accent, border: accent === id ? '3px solid #111' : '3px solid transparent' }}
                />
              ))}
            </div>
            <div className="text-gray-400 mt-2.5 text-[10px]">Pilihan kamu, tersimpan otomatis.</div>
          </div>
        )}
      </div>
    </>
  );
}

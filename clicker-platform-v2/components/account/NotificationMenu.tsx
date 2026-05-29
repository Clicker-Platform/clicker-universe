'use client';

import { ShoppingBag, BookOpen, Bell } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NotificationItem {
  id: string;
  icon: LucideIcon;
  title: string;
  time: string;
  unread?: boolean;
}

// Dummy content for 1a. 1b: fetch real member notifications.
const DUMMY: NotificationItem[] = [
  { id: '1', icon: ShoppingBag, title: 'Pembelian "Bebas Utang 90 Hari" berhasil.', time: '2 jam lalu', unread: true },
  { id: '2', icon: BookOpen, title: 'Produk baru ditambahkan ke library kamu.', time: 'Kemarin', unread: true },
  { id: '3', icon: Bell, title: 'Selamat datang di akun kamu 👋', time: '3 hari lalu' },
];

export function NotificationMenu({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-12 z-40 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] w-[300px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-900">Notifikasi</div>
        <div className="max-h-[320px] overflow-y-auto">
          {DUMMY.map((n) => (
            <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-gray-50">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--member-accent-soft)', color: 'var(--member-accent)' }}
              >
                <n.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800 leading-snug">{n.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{n.time}</div>
              </div>
              {n.unread && (
                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--member-accent)' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

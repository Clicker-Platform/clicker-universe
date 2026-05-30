'use client';

import { Bell } from 'lucide-react';

// No notifications source exists yet (no notifications module). 1b renders an
// intentional empty state inside the same panel chrome; a future module can
// populate this list when one ships.
export function NotificationMenu({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-12 z-40 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] sm:w-[320px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-900">Notifikasi</div>
        <div className="px-4 py-10 flex flex-col items-center text-center">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'var(--account-accent-soft)', color: 'var(--account-accent)' }}
          >
            <Bell size={18} />
          </div>
          <div className="text-sm font-semibold text-gray-700">Belum ada notifikasi</div>
          <div className="text-xs text-gray-400 mt-1">Kabar terbaru akan muncul di sini.</div>
        </div>
      </div>
    </>
  );
}

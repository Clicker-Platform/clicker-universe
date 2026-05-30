'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { Library, User, LogOut, ChevronDown, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';
import { logger } from '@/lib/logger-edge';

interface Props {
  tenant: string;
  email: string;
}

export function BuyerAuthBar({ tenant, email }: Props) {
  const routes = publicRoutes(tenant);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/digital-goods/buyer/logout', {
        method: 'POST',
        headers: { 'x-site-id': tenant },
      });
      try { await signOut(auth); } catch { /* ignore */ }
      window.location.assign(routes.store);
    } catch (e) {
      logger.error('digital_goods.logout.failed', { error: e });
      setLoggingOut(false);
    }
  }

  return (
    <div
      ref={ref}
      className="fixed top-3 right-3 z-50"
      style={{ pointerEvents: 'auto' }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={`Menu akun ${email}`}
        className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition text-sm text-gray-700 px-2 py-1.5 sm:pl-3 sm:pr-2 sm:gap-2"
      >
        <User className="w-4 h-4 text-gray-500" />
        <span className="hidden sm:inline max-w-[160px] truncate">{email}</span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-500">Masuk sebagai</p>
            <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
          </div>
          <Link
            href={routes.library}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <Library className="w-4 h-4 text-gray-400" /> Library
          </Link>
          <Link
            href={routes.profile}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <User className="w-4 h-4 text-gray-400" /> Profil
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 border-t border-gray-100"
          >
            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}

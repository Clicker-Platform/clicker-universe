'use client';

import { useState } from 'react';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { ACCENT_PRESETS } from '@/lib/account/accent';

// Unauthenticated state has no member preset yet → use the default (coral) for the brand panel.
const ACCENT = ACCENT_PRESETS.coral;

export function LoginClient({ tenant }: { tenant: string }) {
  void tenant;
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSent(true); // 1a: static — no fetch
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div
        className="hidden md:flex md:w-[42%] flex-col justify-between p-10 text-white"
        style={{ background: ACCENT.accent, color: ACCENT.fg }}
      >
        <div>
          <div className="font-extrabold text-2xl">Acme ☕</div>
          <p className="mt-3 text-lg opacity-90 leading-snug max-w-xs">
            Akses semua produk &amp; layanan kamu di satu tempat.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm opacity-90">
          <span>★★★★★</span>
          <span>Dipercaya pelanggan setia</span>
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-end p-6 text-sm text-gray-500">
          Sudah punya akun? <span className="ml-1 font-semibold text-gray-900 underline cursor-pointer">Masuk</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            {sent ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto text-green-500 mb-3" size={36} />
                <h1 className="text-2xl font-extrabold text-gray-900">Cek email kamu</h1>
                <p className="text-gray-500 mt-2">
                  Kami sudah mengirim link login ke <strong>{email}</strong>. Klik tombol di email untuk masuk.
                </p>
                <p className="text-xs text-gray-400 mt-3">Link berlaku 15 menit. Cek folder spam bila perlu.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <Mail className="text-gray-300 mb-2" size={28} />
                  <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Masuk</h1>
                  <p className="text-gray-500 mt-1">Tanpa password — kami kirim link ke email kamu.</p>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@email.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as string]: ACCENT.accent }}
                />
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold"
                  style={{ background: ACCENT.accent, color: ACCENT.fg }}
                >
                  Kirim link login <ArrowRight size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

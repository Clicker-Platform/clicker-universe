'use client';

import { useState } from 'react';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { ACCENT_PRESETS, DEFAULT_ACCENT_PRESET } from '@/lib/account/accent';
import type { TenantBrand } from '@/lib/account/brand';

// Pre-auth: no member preset exists yet, so the brand panel uses the default accent.
const ACCENT = ACCENT_PRESETS[DEFAULT_ACCENT_PRESET];

export function LoginClient({ tenant, brand }: { tenant: string; brand: TenantBrand }) {
  void tenant;
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSent(true); // 1a: static — no fetch
  }

  return (
    <div className="min-h-screen flex font-[family-name:var(--font-outfit)] bg-white">
      {/* Brand panel (default accent — personalization is post-login only) */}
      <div
        className="hidden md:flex md:w-[42%] flex-col justify-between p-10"
        style={{ background: ACCENT.accent, color: ACCENT.fg }}
      >
        <div className="flex items-center gap-3">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="w-10 h-10 rounded-full object-cover bg-white/20" />
          ) : (
            <span className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center font-extrabold">
              {brand.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="font-extrabold text-xl">{brand.name}</span>
        </div>
        <div>
          <p className="text-2xl font-extrabold leading-tight max-w-sm">
            Semua produk &amp; layanan kamu di satu tempat.
          </p>
          <p className="mt-3 opacity-90 max-w-xs">Masuk untuk mengakses pembelian dan layanan kamu.</p>
        </div>
        <div className="text-sm opacity-90">Dipercaya pelanggan {brand.name}.</div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center px-6 bg-white">
        <div className="w-full max-w-sm">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto text-green-500 mb-3" size={36} />
              <h1 className="text-2xl font-extrabold text-gray-900">Cek email kamu</h1>
              <p className="text-gray-500 mt-2">
                Kami sudah mengirim link masuk ke <strong>{email}</strong>. Klik tombol di email untuk lanjut.
              </p>
              <p className="text-xs text-gray-400 mt-3">Link berlaku 15 menit. Cek folder spam bila perlu.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <Mail className="text-gray-300 mb-2" size={28} />
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Masuk atau daftar</h1>
                <p className="text-gray-500 mt-1">
                  Masukkan email kamu — kami kirim link aman. Tanpa password.
                </p>
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
                Lanjut dengan email <ArrowRight size={16} />
              </button>
              <p className="text-xs text-gray-400 mt-4 text-center">
                Akun dibuat otomatis jika kamu baru pertama kali.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

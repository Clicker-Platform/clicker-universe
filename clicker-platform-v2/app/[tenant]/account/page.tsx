'use client';

import { ArrowRight } from 'lucide-react';
import { getMockMember, getMockSurfaces, getMockLibrary } from '@/lib/account/mock/providers';
import { LibraryCard } from '@/components/account/LibraryCard';

export default function AccountHome() {
  const member = getMockMember();
  const surfaces = getMockSurfaces(member);
  const library = getMockLibrary(member);

  if (surfaces.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-3">🪴</div>
        <div className="text-xl font-extrabold text-gray-900">Halo, {member.fullName} 👋</div>
        <p className="text-gray-500 mt-2 max-w-xs">
          Belum ada layanan di akun kamu. Jelajahi produk untuk mulai.
        </p>
        <button
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold"
          style={{ background: 'var(--member-accent)', color: 'var(--member-accent-fg)' }}
        >
          Lihat produk <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">
        Halo, {member.fullName} 👋
      </h1>
      <p className="text-gray-500 mt-0.5">Semua produk &amp; layanan kamu, di satu tempat.</p>

      <h2 className="text-sm font-bold text-gray-900 mt-6 mb-3">My Library</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {library.map((it) => (
          <LibraryCard key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}

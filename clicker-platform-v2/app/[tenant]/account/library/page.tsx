'use client';

import { getMockMember, getMockLibrary } from '@/lib/account/mock/providers';
import { LibraryCard } from '@/components/account/LibraryCard';

export default function LibraryPage() {
  const member = getMockMember();
  const library = getMockLibrary(member);

  return (
    <div className="max-w-5xl">
      <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">My Library</h1>
      <p className="text-gray-500 mt-0.5">Produk digital yang kamu miliki.</p>

      {library.length === 0 ? (
        <p className="text-gray-500 mt-8">Belum ada produk di library kamu.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
          {library.map((it, i) => (
            <LibraryCard key={it.id} item={it} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

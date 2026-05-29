'use client';

import { getMockMember, getMockLibrary } from '@/lib/account/mock/providers';
import { LibraryCard } from '@/components/account/LibraryCard';

export default function LibraryPage() {
  const member = getMockMember();
  const library = getMockLibrary(member);

  return (
    <div>
      <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">My Library</h1>

      {library.length === 0 ? (
        <p className="text-gray-500 mt-8">Belum ada produk di library kamu.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5">
          {library.map((it) => (
            <LibraryCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

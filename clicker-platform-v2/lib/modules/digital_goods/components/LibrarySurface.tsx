'use client';

import { useEffect, useState } from 'react';
import { Play, FileText } from 'lucide-react';
import { getLibraryForAccount } from '../surface';
import type { LibraryEntry } from '../types';

// Flat (non-gradient) cover colors, cycled by title for stable per-item color.
// Mirrors components/account/LibraryCard.tsx so the real surface looks native.
const COVER_COLORS = ['#FF6B5E', '#FFD93D', '#6366F1', '#22C55E', '#F59E0B', '#EC4899'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_COLORS[h % COVER_COLORS.length];
}

function EntryCard({ entry }: { entry: LibraryEntry }) {
  const { title, coverImage, contentKind } = entry.productSnapshot;
  const isVideo = contentKind === 'youtube';
  const Icon = isVideo ? Play : FileText;
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
      <div
        className="h-[88px] relative flex items-center justify-center"
        style={coverImage ? undefined : { backgroundColor: colorFor(title) }}
      >
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt={title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <Icon className="text-white/90" size={28} />
        )}
        {isVideo && coverImage && (
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <Play />
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="font-bold text-gray-900">{title}</div>
        <div className="text-gray-400 text-xs mt-0.5">{contentKind.toUpperCase()}</div>
      </div>
    </div>
  );
}

export default function LibrarySurface({ tenant, uid }: { tenant: string; uid: string }) {
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    getLibraryForAccount({ siteId: tenant, uid })
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch(() => {
        if (active) setEntries([]);
      });
    return () => {
      active = false;
    };
  }, [tenant, uid]);

  return (
    <div>
      <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">My Library</h1>

      {entries === null ? (
        <p className="text-gray-400 mt-8">Memuat library kamu…</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500 mt-8">Belum ada produk di library kamu.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

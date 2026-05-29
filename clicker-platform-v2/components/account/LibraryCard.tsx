'use client';

import { Play } from 'lucide-react';
import type { MockLibraryItem } from '@/lib/account/mock/types';

const COVERS = [
  'linear-gradient(135deg,#fda4af,#fb7185)',
  'linear-gradient(135deg,#fcd34d,#fbbf24)',
  'linear-gradient(135deg,#a5b4fc,#818cf8)',
];

export function LibraryCard({ item, index }: { item: MockLibraryItem; index: number }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
      <div
        className="h-[88px] relative"
        style={item.cover ? { backgroundImage: `url(${item.cover})`, backgroundSize: 'cover' } : { background: COVERS[index % COVERS.length] }}
      >
        {item.kind === 'youtube' && (
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <Play />
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="font-bold text-gray-900">{item.title}</div>
        <div className="text-gray-400 text-xs mt-0.5">{item.kind.toUpperCase()}</div>
      </div>
    </div>
  );
}

'use client';

import { Play, FileText } from 'lucide-react';
import type { MockLibraryItem } from '@/lib/account/mock/types';

export function LibraryCard({ item }: { item: MockLibraryItem }) {
  const Icon = item.kind === 'youtube' ? Play : FileText;
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
      <div className="h-[88px] relative bg-gray-300 flex items-center justify-center">
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <Icon className="text-gray-500" size={28} />
        )}
        {item.kind === 'youtube' && item.cover && (
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

'use client';

import { useState } from 'react';
import { ChevronLeft, Type, Palette, MousePointerClick, FormInput } from 'lucide-react';
import { FontsSection } from './site-styles/FontsSection';
import { ComingSoonTile } from './site-styles/ComingSoonTile';

type View = 'index' | 'fonts';

export function SiteStylesPanel() {
  const [view, setView] = useState<View>('index');

  if (view === 'fonts') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <button
          type="button"
          onClick={() => setView('index')}
          className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <ChevronLeft className="h-4 w-4" /> Site Styles
        </button>
        <FontsSection />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <button
        type="button"
        onClick={() => setView('fonts')}
        className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 px-3 py-3 text-left transition-colors"
      >
        <Type className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
        <div className="flex-1">
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Fonts</div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Heading + body pack</div>
        </div>
      </button>
      <ComingSoonTile icon={Palette} label="Colors" />
      <ComingSoonTile icon={MousePointerClick} label="Buttons" />
      <ComingSoonTile icon={FormInput} label="Forms" />
    </div>
  );
}

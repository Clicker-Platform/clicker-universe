'use client';

import { useState } from 'react';
import { ChevronLeft, Type, Palette, FormInput } from 'lucide-react';
import { FontsSection } from './site-styles/FontsSection';
import { ButtonsSection } from './site-styles/ButtonsSection';
import { ComingSoonTile } from './site-styles/ComingSoonTile';

type View = 'index' | 'fonts' | 'buttons';

type Props = {
  templateId?: string | null;
};

export function SiteStylesPanel({ templateId }: Props) {
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
        <FontsSection templateId={templateId} />
      </div>
    );
  }

  if (view === 'buttons') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <button
          type="button"
          onClick={() => setView('index')}
          className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <ChevronLeft className="h-4 w-4" /> Site Styles
        </button>
        <ButtonsSection />
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
      <button
        type="button"
        onClick={() => setView('buttons')}
        className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 px-3 py-3 text-left transition-colors"
      >
        <div className="h-4 w-4 text-neutral-700 dark:text-neutral-200">
          <svg className="h-full w-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15H3.101m0 0A9 9 0 0021.101 8.5M3.101 15a9 9 0 018.974-7.5M3 12a9 9 0 0118 0m0 0h-2m2 0l-2 2m0-2l2-2" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Buttons</div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Style pack</div>
        </div>
      </button>
      <ComingSoonTile icon={FormInput} label="Forms" />
    </div>
  );
}

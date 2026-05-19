'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FONT_PACKS, getPackById } from '@/lib/fonts/packs';
import { getAppearanceStyles, setFontPackId } from '@/lib/appearance/api';
import { useSite } from '@/lib/site-context';
import { FontPackCard } from './FontPackCard';

function applyFontVarsToDocument(packId: string | null) {
  const pack = getPackById(packId);
  const root = document.documentElement;
  if (pack) {
    root.style.setProperty('--font-heading', 'var(' + pack.heading.cssVar + ')');
    root.style.setProperty('--font-body', 'var(' + pack.body.cssVar + ')');
  } else {
    root.style.removeProperty('--font-heading');
    root.style.removeProperty('--font-body');
  }
}

export function FontsSection() {
  const { siteId } = useSite();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAppearanceStyles(siteId).then(s => {
      if (!cancelled) {
        setActiveId(s.fontPackId);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [siteId]);

  const handlePick = async (packId: string) => {
    const prev = activeId;
    setActiveId(packId);
    applyFontVarsToDocument(packId);
    try {
      await setFontPackId(siteId, packId);
    } catch (e) {
      setActiveId(prev);
      applyFontVarsToDocument(prev);
      toast.error("Couldn't save font choice. Try again.");
    }
  };

  const handleReset = async () => {
    const prev = activeId;
    setActiveId(null);
    applyFontVarsToDocument(null);
    try {
      await setFontPackId(siteId, null);
    } catch {
      setActiveId(prev);
      applyFontVarsToDocument(prev);
      toast.error("Couldn't reset. Try again.");
    }
  };

  const activePack = getPackById(activeId);

  return (
    <div className="flex flex-col gap-4">
      {activePack && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-50 dark:bg-neutral-800 px-3 py-2">
          <div className="text-xs">
            <div className="text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Active</div>
            <div className="text-neutral-900 dark:text-neutral-100 font-medium">{activePack.name}</div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-blue-600 hover:underline"
          >
            Reset to template
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {FONT_PACKS.map(pack => (
            <FontPackCard
              key={pack.id}
              pack={pack}
              active={activeId === pack.id}
              onClick={() => handlePick(pack.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

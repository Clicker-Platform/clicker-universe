'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BUTTON_PACKS } from '@/lib/buttonPacks/packs';
import { getAppearanceStyles, setButtonPackId } from '@/lib/appearance/api';
import { useSite } from '@/lib/site-context';
import { ButtonPackCard } from './ButtonPackCard';
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';

export function ButtonsSection() {
  const { siteId } = useSite();
  const [activeId, setActiveId] = useState<ButtonPackId | null>(null);
  const [colors, setColors] = useState<ButtonColors>(DEFAULT_BUTTON_COLORS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAppearanceStyles(siteId).then(s => {
      if (!cancelled) {
        setActiveId(s.buttonPackId);
        setColors(s.buttonColors);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [siteId]);

  const handlePick = async (packId: ButtonPackId) => {
    const prev = activeId;
    setActiveId(packId);
    try {
      await setButtonPackId(siteId, packId);
    } catch {
      setActiveId(prev);
      toast.error("Couldn't save button pack. Try again.");
    }
  };

  if (loading) return <div className="text-sm text-neutral-500">Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Pack</div>
        <div className="grid grid-cols-2 gap-3">
          {BUTTON_PACKS.map(p => (
            <ButtonPackCard
              key={p.id}
              pack={p}
              active={activeId === p.id}
              onClick={() => handlePick(p.id)}
            />
          ))}
        </div>
      </div>
      {/* Colors editor + preview tile arrive in Task 11 */}
    </div>
  );
}

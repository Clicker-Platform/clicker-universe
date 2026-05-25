'use client';

import { useState } from 'react';
import { ButtonPackProvider } from '@/components/ButtonPackProvider';
import { UnifiedButton } from '@/components/ui/UnifiedButton';
import { BUTTON_PACKS } from '@/lib/buttonPacks/packs';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';

export default function ButtonsDevPage() {
  const [packId, setPackId] = useState<ButtonPackId>('pill');
  const [colors, setColors] = useState<ButtonColors>(DEFAULT_BUTTON_COLORS);

  return (
    <ButtonPackProvider packId={packId} colors={colors}>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold">UnifiedButton — Dev Preview</h1>

        <div className="flex gap-2 flex-wrap">
          {BUTTON_PACKS.map(p => (
            <button
              key={p.id}
              onClick={() => setPackId(p.id)}
              className={`px-3 py-1 rounded border ${p.id === packId ? 'bg-blue-600 text-white' : 'bg-white'}`}
            >
              {p.displayName}
            </button>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          <label className="text-sm">Primary fill</label>
          <input type="color" value={colors.primaryFill}
                 onChange={e => setColors({ ...colors, primaryFill: e.target.value })} />
          <code className="text-xs">{colors.primaryFill}</code>
        </div>

        {(['sm', 'md', 'lg'] as const).map(size => (
          <section key={size} className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500">Size: {size}</h2>
            <div className="flex gap-3 items-center flex-wrap">
              <UnifiedButton tier="primary" size={size} href="#">Primary</UnifiedButton>
              <UnifiedButton tier="secondary" size={size} href="#">Secondary</UnifiedButton>
              <UnifiedButton tier="tertiary" size={size} href="#">Tertiary</UnifiedButton>
              <UnifiedButton tier="primary" size={size} onClick={() => {}}>Button</UnifiedButton>
              <UnifiedButton tier="primary" size={size} disabled>Disabled</UnifiedButton>
              <UnifiedButton tier="primary" size={size} loading>Loading</UnifiedButton>
            </div>
          </section>
        ))}

        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500">Full width</h2>
          <UnifiedButton tier="primary" fullWidth href="#">Full Width Primary</UnifiedButton>
        </section>
      </div>
    </ButtonPackProvider>
  );
}

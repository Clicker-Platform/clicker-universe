'use client';

import { ButtonPackProvider } from '@/components/ButtonPackProvider';
import { UnifiedButton } from '@/components/ui/UnifiedButton';
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';

type Props = {
  packId: ButtonPackId | null;
  colors: ButtonColors;
};

export function ButtonsPreviewTile({ packId, colors }: Props) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Preview</div>
      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-4">
        <ButtonPackProvider packId={packId} colors={colors}>
          {(['sm', 'md', 'lg'] as const).map(size => (
            <div key={size} className="mb-3 last:mb-0">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 text-center mb-1">{size}</div>
              <div className="flex items-center justify-center gap-2">
                <UnifiedButton tier="primary" size={size} onClick={() => {}}>Primary</UnifiedButton>
                <UnifiedButton tier="secondary" size={size} onClick={() => {}}>Secondary</UnifiedButton>
                <UnifiedButton tier="tertiary" size={size} onClick={() => {}}>Tertiary</UnifiedButton>
              </div>
            </div>
          ))}
        </ButtonPackProvider>
      </div>
    </div>
  );
}

'use client';

import { ItemCondition } from '../types';
import { CONDITION_LABELS, CONDITION_COLORS } from '../constants';

interface Props {
  value: ItemCondition;
  onChange: (v: ItemCondition) => void;
}

const CONDITIONS: ItemCondition[] = ['BNIB', 'BNOB', 'SECOND', 'BROKEN'];

export function ConditionSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">Pilih Kondisi</p>
      <div className="grid grid-cols-4 gap-2">
        {CONDITIONS.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition
              ${value === c
                ? `${CONDITION_COLORS[c]} bg-muted`
                : 'border-border text-muted-foreground hover:bg-muted'
              }`}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{CONDITION_LABELS[value]}</p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { BLOCK_OPTIONS, getDefaultData } from '../../blockDefinitions';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import type { BlockType, PageBlock } from '@/data/mockData';
import { Plus } from 'lucide-react';

const EXCLUDED_TYPES: BlockType[] = ['columns', 'grid'];

interface MiniBlockPickerProps {
  onPick: (block: PageBlock) => void;
  templateId?: string;
}

export function MiniBlockPicker({ onPick, templateId = 'classic' }: MiniBlockPickerProps) {
  const [open, setOpen] = useState(false);
  const [moduleBlocks, setModuleBlocks] = useState<
    { type: BlockType; label: string; icon: React.ElementType }[]
  >([]);

  useEffect(() => {
    const unsubscribe = subscribeToEnabledModules((modules) => {
      const opts: { type: BlockType; label: string; icon: React.ElementType }[] = [];
      modules.forEach(mod => {
        mod.blocks?.forEach(b => {
          opts.push({ type: b.type as BlockType, label: b.label, icon: Plus });
        });
      });
      setModuleBlocks(opts);
    });
    return () => unsubscribe();
  }, []);

  const filtered = BLOCK_OPTIONS.filter(o => !EXCLUDED_TYPES.includes(o.type as BlockType));
  const allOptions = [...filtered, ...moduleBlocks];

  const handlePick = (type: BlockType) => {
    const newBlock: PageBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      data: getDefaultData(type, templateId),
    };
    onPick(newBlock);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-neutral-700 rounded-md text-sm text-neutral-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <Plus size={14} /> Add block
      </button>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-neutral-700 rounded-md p-2 bg-white dark:bg-neutral-900 space-y-1 max-h-72 overflow-y-auto">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Pick a block</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {allOptions.map(opt => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => handlePick(opt.type as BlockType)}
              className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-neutral-700 dark:text-neutral-300"
            >
              <Icon size={16} />
              <span className="text-[10px] text-center leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

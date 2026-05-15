'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, Trash2 } from 'lucide-react';
import { BLOCK_OPTIONS } from '../../blockDefinitions';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import type { PageBlock } from '@/data/mockData';
import { MiniBlockPicker } from './MiniBlockPicker';

interface NestedBlockListProps {
  blocksList: PageBlock[];
  onBlocksChange: (blocks: PageBlock[]) => void;
  onBlockClick: (blockId: string) => void;
  templateId?: string;
}

interface SortableBlockRowProps {
  block: PageBlock;
  labelLookup: Record<string, string>;
  onClick: () => void;
  onDelete: () => void;
}

function SortableBlockRow({ block, labelLookup, onClick, onDelete }: SortableBlockRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const label = labelLookup[block.type] || block.type;
  const blockId = block.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-md"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-grab"
        aria-label={`Drag ${blockId}`}
      >
        <GripVertical size={14} />
      </button>
      <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1 truncate">{label}</span>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Edit block ${blockId}`}
        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        <ChevronRight size={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete block ${blockId}`}
        className="text-neutral-400 hover:text-red-500"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function NestedBlockList({
  blocksList,
  onBlocksChange,
  onBlockClick,
  templateId,
}: NestedBlockListProps) {
  const [labelLookup, setLabelLookup] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    BLOCK_OPTIONS.forEach(o => { base[o.type] = o.label; });
    return base;
  });

  useEffect(() => {
    const unsubscribe = subscribeToEnabledModules((modules) => {
      setLabelLookup(prev => {
        const next = { ...prev };
        modules.forEach(mod => mod.blocks?.forEach(b => { next[b.type] = b.label; }));
        return next;
      });
    });
    return () => unsubscribe();
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocksList.findIndex(b => b.id === active.id);
    const newIndex = blocksList.findIndex(b => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onBlocksChange(arrayMove(blocksList, oldIndex, newIndex));
  };

  const handleDelete = (blockId: string) => {
    onBlocksChange(blocksList.filter(b => b.id !== blockId));
  };

  const handleAdd = (newBlock: PageBlock) => {
    onBlocksChange([...blocksList, newBlock]);
  };

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={blocksList.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {blocksList.map(block => (
              <SortableBlockRow
                key={block.id}
                block={block}
                labelLookup={labelLookup}
                onClick={() => onBlockClick(block.id)}
                onDelete={() => handleDelete(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <MiniBlockPicker onPick={handleAdd} templateId={templateId} />
    </div>
  );
}

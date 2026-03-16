'use client';

import { useState, useCallback } from 'react';
import { PageBlock } from '@/data/mockData';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Lock } from 'lucide-react';
import { BlockOutlineItem } from './BlockOutlineItem';
import { useEditor } from './EditorContext';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

interface BlockManagerProps {
    blocks: PageBlock[];
    onChange: (blocks: PageBlock[]) => void;
    onAddClick?: () => void;
}

export const BlockManager = ({ blocks, onChange, onAddClick }: BlockManagerProps) => {
    const { selectedBlockId, setSelectedBlockId } = useEditor();
    const [blockToDelete, setBlockToDelete] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = blocks.findIndex((item) => item.id === active.id);
            const newIndex = blocks.findIndex((item) => item.id === over.id);
            onChange(arrayMove(blocks, oldIndex, newIndex));
        }
    }, [blocks, onChange]);

    const deleteBlock = useCallback((id: string) => {
        setBlockToDelete(id);
    }, []);

    const confirmDelete = useCallback(() => {
        if (blockToDelete) {
            onChange(blocks.filter(b => b.id !== blockToDelete));
            setBlockToDelete(null);
        }
    }, [blockToDelete, blocks, onChange]);

    return (
        <div>
            {/* Pinned Header */}
            <div
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                    selectedBlockId === 'chrome:header'
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
                onClick={() => setSelectedBlockId?.('chrome:header')}
            >
                <Lock size={13} className="flex-shrink-0 text-neutral-600" />
                <span className="flex-1 text-xs font-medium truncate">Header Navigation</span>
            </div>

            <div className="border-l-2 border-dashed border-neutral-800 ml-3.5 my-0.5">
                {blocks.length === 0 ? (
                    <div className="text-center py-6 px-3">
                        <p className="text-neutral-600 mb-2 text-xs">No blocks yet</p>
                        {onAddClick && (
                            <button
                                type="button"
                                onClick={onAddClick}
                                className="text-blue-400 hover:text-blue-300 transition-colors text-xs font-medium"
                            >
                                + Add your first block
                            </button>
                        )}
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={blocks.map(b => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div>
                                {blocks.map(block => (
                                    <BlockOutlineItem
                                        key={block.id}
                                        block={block}
                                        isSelected={selectedBlockId === block.id}
                                        onClick={() => setSelectedBlockId?.(block.id)}
                                        onDelete={deleteBlock}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* Pinned Footer */}
            <div
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                    selectedBlockId === 'chrome:footer'
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
                onClick={() => setSelectedBlockId?.('chrome:footer')}
            >
                <Lock size={13} className="flex-shrink-0 text-neutral-600" />
                <span className="flex-1 text-xs font-medium truncate">Site Footer</span>
            </div>

            <ConfirmationDialog
                isOpen={!!blockToDelete}
                title="Delete Block"
                message="Are you sure you want to delete this block? This action cannot be undone."
                onConfirm={confirmDelete}
                onCancel={() => setBlockToDelete(null)}
                confirmLabel="Delete Block"
            />
        </div>
    );
};

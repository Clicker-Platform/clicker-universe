'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageBlock } from '@/data/mockData';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
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
import { BlockTreeNode } from './BlockTreeNode';
import { useEditor } from './EditorContext';
import { subscribeToEnabledModules } from '@/lib/modules/registry';

function toggleHiddenDeep(blocks: PageBlock[], id: string): PageBlock[] {
    return blocks.map(block => {
        if (block.id === id) return { ...block, hidden: !block.hidden };

        if (block.type === 'columns' && Array.isArray(block.data?.columns)) {
            const nextColumns = block.data.columns.map((col: any) => ({
                ...col,
                blocks: Array.isArray(col.blocks) ? toggleHiddenDeep(col.blocks, id) : col.blocks,
            }));
            return { ...block, data: { ...block.data, columns: nextColumns } };
        }

        if (block.type === 'grid' && Array.isArray(block.data?.cells)) {
            const nextCells = block.data.cells.map((cell: any) => {
                if (!cell.block) return cell;
                const [next] = toggleHiddenDeep([cell.block], id);
                return { ...cell, block: next };
            });
            return { ...block, data: { ...block.data, cells: nextCells } };
        }

        return block;
    });
}

function removeBlockDeep(blocks: PageBlock[], id: string): PageBlock[] {
    const result: PageBlock[] = [];
    for (const block of blocks) {
        if (block.id === id) continue;

        if (block.type === 'columns' && Array.isArray(block.data?.columns)) {
            const nextColumns = block.data.columns.map((col: any) => ({
                ...col,
                blocks: Array.isArray(col.blocks) ? removeBlockDeep(col.blocks, id) : col.blocks,
            }));
            result.push({ ...block, data: { ...block.data, columns: nextColumns } });
            continue;
        }

        if (block.type === 'grid' && Array.isArray(block.data?.cells)) {
            const nextCells = block.data.cells.map((cell: any) => {
                if (cell.block && cell.block.id === id) return { ...cell, block: null };
                if (cell.block) {
                    const [stripped] = removeBlockDeep([cell.block], id);
                    return { ...cell, block: stripped ?? null };
                }
                return cell;
            });
            result.push({ ...block, data: { ...block.data, cells: nextCells } });
            continue;
        }

        result.push(block);
    }
    return result;
}

interface BlockManagerProps {
    blocks: PageBlock[];
    onChange: (blocks: PageBlock[]) => void;
    templateId?: string;
    onAddClick?: () => void;
}

export const BlockManager = ({ blocks, onChange, templateId, onAddClick }: BlockManagerProps) => {
    const { selection, setSelection } = useEditor();
    // Helper booleans for the chrome rows; for top-level blocks we inline the check.
    const isChromeSelected = (chromeId: 'header' | 'footer' | 'bottomnav') =>
        selection.kind === 'chrome' && selection.chromeId === chromeId;
    const [moduleBlockLabels, setModuleBlockLabels] = useState<Record<string, string>>({});

    useEffect(() => {
        const unsubscribe = subscribeToEnabledModules((modules) => {
            const labels: Record<string, string> = {};
            modules.forEach(mod => {
                mod.blocks?.forEach(b => { labels[b.type] = b.label; });
            });
            setModuleBlockLabels(labels);
        });
        return () => unsubscribe();
    }, []);

    const sensors = useSensors(
        useSensor(MouseSensor),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 8,
            },
        }),
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
        onChange(removeBlockDeep(blocks, id));
    }, [blocks, onChange]);

    const toggleHidden = useCallback((id: string) => {
        onChange(toggleHiddenDeep(blocks, id));
    }, [blocks, onChange]);

    return (
        <div>
            {/* Pinned Header */}
            <div
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                    isChromeSelected('header')
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                onClick={() => setSelection({ kind: 'chrome', chromeId: 'header' })}
            >
                <Lock size={13} className="flex-shrink-0 text-neutral-400 dark:text-neutral-600" />
                <span className="flex-1 text-xs font-medium truncate">Header Navigation</span>
            </div>

            <div className="border-l-2 border-dashed border-gray-200 dark:border-neutral-800 ml-3.5 my-0.5">
                {blocks.length === 0 ? (
                    <div className="text-center py-6 px-3">
                        <p className="text-neutral-400 dark:text-neutral-600 mb-2 text-xs">No blocks yet</p>
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
                                    <BlockTreeNode
                                        key={block.id}
                                        block={block}
                                        depth={0}
                                        moduleBlockLabels={moduleBlockLabels}
                                        onDelete={deleteBlock}
                                        onToggleHidden={toggleHidden}
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
                    isChromeSelected('footer')
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                onClick={() => setSelection({ kind: 'chrome', chromeId: 'footer' })}
            >
                <Lock size={13} className="flex-shrink-0 text-neutral-400 dark:text-neutral-600" />
                <span className="flex-1 text-xs font-medium truncate">Site Footer</span>
            </div>

            {/* Pinned Bottom Nav */}
            <div
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                    isChromeSelected('bottomnav')
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                onClick={() => setSelection({ kind: 'chrome', chromeId: 'bottomnav' })}
            >
                <Lock size={13} className="flex-shrink-0 text-neutral-400 dark:text-neutral-600" />
                <span className="flex-1 text-xs font-medium truncate">Bottom Navigation</span>
            </div>

        </div>
    );
};

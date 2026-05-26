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
import { Lock, ChevronsDownUp, ChevronsUpDown, Layers } from 'lucide-react';
import { BlockTreeNode } from './BlockTreeNode';
import { useEditor } from './EditorContext';
import { subscribeToEnabledModules } from '@/lib/modules/registry';

/** Walks the tree and collects every container ID (block.id for columns/grid
 *  blocks, slot.id for each column slot or grid cell with children). */
function collectCollapsibleIds(blocks: PageBlock[]): string[] {
    const ids: string[] = [];
    const walk = (list: PageBlock[]) => {
        for (const block of list) {
            if (block.type === 'columns' && Array.isArray(block.data?.columns)) {
                ids.push(block.id);
                for (const col of block.data.columns) {
                    if (Array.isArray(col?.blocks) && col.blocks.length > 0) {
                        ids.push(col.id);
                        walk(col.blocks);
                    }
                }
            } else if (block.type === 'grid' && Array.isArray(block.data?.cells)) {
                ids.push(block.id);
                for (const cell of block.data.cells) {
                    if (cell?.block) {
                        ids.push(cell.id);
                        walk([cell.block]);
                    }
                }
            } else if (block.type === 'feature_cards' && Array.isArray(block.data?.cards) && block.data.cards.length > 0) {
                ids.push(block.id);
            }
        }
    };
    walk(blocks);
    return ids;
}

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
    /** When true, BlockManager renders its own "Layers" title bar with the
     *  expand/collapse toggle. Mobile sheet has its own title — pass false. */
    renderTitle?: boolean;
}

export const BlockManager = ({ blocks, onChange, templateId, onAddClick, renderTitle = false }: BlockManagerProps) => {
    const { selection, setSelection } = useEditor();
    // Helper booleans for the chrome rows; for top-level blocks we inline the check.
    const isChromeSelected = (chromeId: 'header' | 'footer' | 'bottomnav') =>
        selection.kind === 'chrome' && selection.chromeId === chromeId;
    const [moduleBlockLabels, setModuleBlockLabels] = useState<Record<string, string>>({});
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

    const toggleCollapsed = useCallback((id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setCollapsedIds(new Set());
    }, []);

    const collapseAll = useCallback(() => {
        setCollapsedIds(new Set(collectCollapsibleIds(blocks)));
    }, [blocks]);

    const collapsibleIds = collectCollapsibleIds(blocks);
    const anyCollapsible = collapsibleIds.length > 0;
    const allCollapsed = anyCollapsible && collapsibleIds.every(id => collapsedIds.has(id));

    const toggleAll = useCallback(() => {
        if (allCollapsed) expandAll(); else collapseAll();
    }, [allCollapsed, expandAll, collapseAll]);

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

    /** Rename a column slot, grid cell, or card by its slotId. Empty/whitespace
     *  label clears the field so the navigator falls back to the default
     *  ("Column N" / "Cell N" / headline-or-"Untitled Card"). */
    const renameSlot = useCallback((slotId: string, nextLabel: string) => {
        const trimmed = nextLabel.trim();
        const renameInBlocks = (list: PageBlock[]): PageBlock[] => list.map(block => {
            if (block.type === 'columns' && Array.isArray(block.data?.columns)) {
                let changed = false;
                const nextColumns = block.data.columns.map((col: any) => {
                    if (col?.id === slotId) {
                        changed = true;
                        const { label: _drop, ...rest } = col;
                        return trimmed ? { ...col, label: trimmed } : rest;
                    }
                    if (Array.isArray(col?.blocks)) {
                        const recursed = renameInBlocks(col.blocks);
                        if (recursed !== col.blocks) {
                            changed = true;
                            return { ...col, blocks: recursed };
                        }
                    }
                    return col;
                });
                return changed ? { ...block, data: { ...block.data, columns: nextColumns } } : block;
            }
            if (block.type === 'grid' && Array.isArray(block.data?.cells)) {
                let changed = false;
                const nextCells = block.data.cells.map((cell: any) => {
                    if (cell?.id === slotId) {
                        changed = true;
                        const { label: _drop, ...rest } = cell;
                        return trimmed ? { ...cell, label: trimmed } : rest;
                    }
                    if (cell?.block) {
                        const [recursed] = renameInBlocks([cell.block]);
                        if (recursed !== cell.block) {
                            changed = true;
                            return { ...cell, block: recursed };
                        }
                    }
                    return cell;
                });
                return changed ? { ...block, data: { ...block.data, cells: nextCells } } : block;
            }
            if (block.type === 'feature_cards' && Array.isArray(block.data?.cards)) {
                let changed = false;
                const nextCards = block.data.cards.map((card: any) => {
                    if (card?.id === slotId) {
                        changed = true;
                        const { navLabel: _drop, ...rest } = card;
                        return trimmed ? { ...card, navLabel: trimmed } : rest;
                    }
                    return card;
                });
                return changed ? { ...block, data: { ...block.data, cards: nextCards } } : block;
            }
            return block;
        });
        onChange(renameInBlocks(blocks));
    }, [blocks, onChange]);

    const body = (
        <>
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
                                        collapsedIds={collapsedIds}
                                        onToggleCollapsed={toggleCollapsed}
                                        onRenameSlot={renameSlot}
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
        </>
    );

    if (!renderTitle) {
        return <div>{body}</div>;
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="px-3 h-10 border-b border-gray-200 dark:border-neutral-800 font-bold text-sm text-neutral-900 dark:text-neutral-200 flex items-center gap-2 flex-shrink-0">
                <Layers size={15} className="text-neutral-500 dark:text-neutral-400" />
                <span className="flex-1">Layers</span>
                {anyCollapsible && (
                    <button
                        type="button"
                        onClick={toggleAll}
                        title={allCollapsed ? 'Expand all' : 'Collapse all'}
                        className="p-1 rounded text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        {allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                    </button>
                )}
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar py-1">
                {body}
            </div>
        </div>
    );
};

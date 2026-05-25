'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { PageBlock } from '@/data/mockData';

/**
 * Single source of truth for "what is currently selected/active in the editor".
 *
 * Replaces the previous pair (selectedBlockId, activeContainerSlotId) that had
 * to be kept in sync via useEffect — that shape caused render loops. Now there
 * is exactly one field, one setter, and every transition is an atomic single
 * write.
 *
 * Arrays for `blocks.ids` and `slots.ids` from day one even though current UI
 * always sets length=1 — future multi-select (Cmd+click, merge cells) is a
 * purely additive change with no shape break.
 */
export type EditorSelection =
    | { kind: 'none' }
    | { kind: 'blocks'; ids: string[] }
    | { kind: 'slots'; containerId: string; ids: string[] }
    | { kind: 'chrome'; chromeId: 'header' | 'footer' | 'bottomnav' };

/** Helper: single-block selection id, or null. */
export function singleBlockId(s: EditorSelection): string | null {
    return s.kind === 'blocks' && s.ids.length === 1 ? s.ids[0] : null;
}

/** Helper: single-slot selection id, or null. */
export function singleSlotId(s: EditorSelection): string | null {
    return s.kind === 'slots' && s.ids.length === 1 ? s.ids[0] : null;
}

interface EditorContextType {
    blocks: PageBlock[];
    setBlocks: (blocks: PageBlock[]) => void;

    // Single source of truth for what is currently selected/active.
    selection: EditorSelection;
    setSelection: (s: EditorSelection) => void;

    hoveredBlockId: string | null;
    setHoveredBlockId: (id: string | null) => void;
    deviceView: 'desktop' | 'tablet' | 'mobile';
    setDeviceView: (view: 'desktop' | 'tablet' | 'mobile') => void;
    showGuides: boolean;
    setShowGuides: (v: boolean) => void;
    updateBlockData: (id: string, data: any) => void;
    addBlock: (block: PageBlock) => void;
    removeBlock: (id: string) => void;
    moveBlock: (oldIndex: number, newIndex: number) => void;
}

export const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children, blocks, onChange }: { children: ReactNode, blocks: PageBlock[], onChange: (blocks: PageBlock[] | ((prev: PageBlock[]) => PageBlock[])) => void }) {
    const [selection, setSelection] = useState<EditorSelection>({ kind: 'none' });
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
    const [showGuides, setShowGuides] = useState(true);
    const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>(() => {
        if (typeof window === 'undefined') return 'desktop';
        const saved = localStorage.getItem('canvas_studio_device_view');
        return (saved as 'desktop' | 'tablet' | 'mobile') || 'desktop';
    });

    useEffect(() => {
        localStorage.setItem('canvas_studio_device_view', deviceView);
    }, [deviceView]);

    const updateBlockData = useCallback((id: string, data: any) => {
        const walk = (list: PageBlock[]): PageBlock[] => list.map(block => {
            if (block.id === id) return { ...block, data: { ...block.data, ...data } };

            if (block.type === 'columns' && Array.isArray(block.data?.columns)) {
                const nextColumns = block.data.columns.map((col: any) => ({
                    ...col,
                    blocks: Array.isArray(col.blocks) ? walk(col.blocks) : col.blocks,
                }));
                return { ...block, data: { ...block.data, columns: nextColumns } };
            }

            if (block.type === 'grid' && Array.isArray(block.data?.cells)) {
                const nextCells = block.data.cells.map((cell: any) => {
                    if (!cell.block) return cell;
                    const [next] = walk([cell.block]);
                    return { ...cell, block: next };
                });
                return { ...block, data: { ...block.data, cells: nextCells } };
            }

            return block;
        });
        onChange(walk);
    }, [onChange]);

    const addBlock = useCallback((block: PageBlock) => {
        const activeId = singleBlockId(selection);
        onChange(prev => {
            if (!activeId) return [...prev, block];
            const idx = prev.findIndex(b => b.id === activeId);
            if (idx === -1) return [...prev, block];
            const next = [...prev];
            next.splice(idx + 1, 0, block);
            return next;
        });
    }, [onChange, selection]);

    const removeBlock = useCallback((id: string) => {
        onChange(prev => prev.filter(block => block.id !== id));
        // If the removed block was selected, clear selection.
        setSelection(prev => {
            if (prev.kind === 'blocks' && prev.ids.includes(id)) {
                const remaining = prev.ids.filter(x => x !== id);
                return remaining.length > 0 ? { kind: 'blocks', ids: remaining } : { kind: 'none' };
            }
            return prev;
        });
    }, [onChange]);

    const moveBlock = useCallback((oldIndex: number, newIndex: number) => {
        onChange(prev => {
            const newBlocks = [...prev];
            const [movedBlock] = newBlocks.splice(oldIndex, 1);
            newBlocks.splice(newIndex, 0, movedBlock);
            return newBlocks;
        });
    }, [onChange]);

    return (
        <EditorContext.Provider value={{
            blocks,
            setBlocks: onChange,
            selection,
            setSelection,
            hoveredBlockId,
            setHoveredBlockId,
            deviceView,
            setDeviceView,
            showGuides,
            setShowGuides,
            updateBlockData,
            addBlock,
            removeBlock,
            moveBlock,
        }}>
            {children}
        </EditorContext.Provider>
    );
}

export function useEditor() {
    const context = useContext(EditorContext);
    if (context === undefined) {
        throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
}

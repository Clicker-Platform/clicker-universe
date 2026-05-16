'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
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

    // New selection model (commit 1 introduces this alongside the old fields).
    selection: EditorSelection;
    setSelection: (s: EditorSelection) => void;

    // Backwards-compat derived getters. These continue to work during the
    // migration; they're computed from `selection`. The compat setters write
    // back through setSelection so transitions stay atomic.
    // After commit 2 these are removed; consumers read `selection` directly.
    selectedBlockId: string | null;
    setSelectedBlockId: (id: string | null) => void;
    activeContainerSlotId: string | null;
    setActiveContainerSlotId: (id: string | null) => void;

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

    // Derived backwards-compat getters. Computed in useMemo so reference is
    // stable when selection hasn't changed (avoids spurious re-renders in
    // consumers that compare via Object.is on the context value).
    const selectedBlockId = useMemo<string | null>(() => {
        if (selection.kind === 'blocks' && selection.ids.length === 1) return selection.ids[0];
        if (selection.kind === 'chrome') return `chrome:${selection.chromeId}`;
        return null;
    }, [selection]);

    const activeContainerSlotId = useMemo<string | null>(() => {
        return selection.kind === 'slots' && selection.ids.length === 1 ? selection.ids[0] : null;
    }, [selection]);

    // Compat setters route writes through setSelection so transitions stay atomic.
    // setSelectedBlockId(null) → clears selection ONLY if currently a block is
    // selected — preserves chrome / slot state if those were active. Same for
    // setActiveContainerSlotId.
    const setSelectedBlockId = useCallback((id: string | null) => {
        if (id === null) {
            setSelection(prev => prev.kind === 'blocks' ? { kind: 'none' } : prev);
            return;
        }
        // Chrome sentinel ids (legacy callers may still pass these strings).
        if (id === 'chrome:header') return setSelection({ kind: 'chrome', chromeId: 'header' });
        if (id === 'chrome:footer') return setSelection({ kind: 'chrome', chromeId: 'footer' });
        if (id === 'chrome:bottomnav') return setSelection({ kind: 'chrome', chromeId: 'bottomnav' });
        setSelection({ kind: 'blocks', ids: [id] });
    }, []);

    const setActiveContainerSlotId = useCallback((id: string | null) => {
        if (id === null) {
            setSelection(prev => prev.kind === 'slots' ? { kind: 'none' } : prev);
            return;
        }
        // Compat setter doesn't know the parent containerId. Callers using this
        // legacy path will get containerId='' — acceptable during migration
        // because no current consumer reads containerId. Commit 3 callers use
        // setSelection directly with the full slot info.
        setSelection({ kind: 'slots', containerId: '', ids: [id] });
    }, []);

    const updateBlockData = useCallback((id: string, data: any) => {
        onChange(prev => prev.map(block =>
            block.id === id ? { ...block, data: { ...block.data, ...data } } : block
        ));
    }, [onChange]);

    const addBlock = useCallback((block: PageBlock) => {
        onChange(prev => [...prev, block]);
    }, [onChange]);

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
            selectedBlockId,
            setSelectedBlockId,
            activeContainerSlotId,
            setActiveContainerSlotId,
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

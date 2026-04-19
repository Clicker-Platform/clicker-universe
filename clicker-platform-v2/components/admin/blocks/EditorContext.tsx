'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { PageBlock } from '@/data/mockData';

interface EditorContextType {
    blocks: PageBlock[];
    setBlocks: (blocks: PageBlock[]) => void;
    selectedBlockId: string | null;
    setSelectedBlockId: (id: string | null) => void;
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

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children, blocks, onChange }: { children: ReactNode, blocks: PageBlock[], onChange: (blocks: PageBlock[] | ((prev: PageBlock[]) => PageBlock[])) => void }) {
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
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
        onChange(prev => prev.map(block => 
            block.id === id ? { ...block, data: { ...block.data, ...data } } : block
        ));
    }, [onChange]);

    const addBlock = useCallback((block: PageBlock) => {
        onChange(prev => [...prev, block]);
    }, [onChange]);

    const removeBlock = useCallback((id: string) => {
        onChange(prev => prev.filter(block => block.id !== id));
        if (selectedBlockId === id) setSelectedBlockId(null);
    }, [selectedBlockId, onChange]);

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
            selectedBlockId,
            setSelectedBlockId,
            hoveredBlockId,
            setHoveredBlockId,
            deviceView,
            setDeviceView,
            showGuides,
            setShowGuides,
            updateBlockData,
            addBlock,
            removeBlock,
            moveBlock
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

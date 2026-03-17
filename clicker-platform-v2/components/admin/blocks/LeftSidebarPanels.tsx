'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Plus, FileText, LayoutList, LayoutGrid } from 'lucide-react';
import { usePageStudio } from './PageStudioContext';
import { useEditor } from './EditorContext';
import { BLOCK_OPTIONS, getDefaultData } from './blockDefinitions';
import { subscribeToEnabledModules, MODULE_ICONS } from '@/lib/modules/registry';
import { BlockType, PageBlock } from '@/data/mockData';
import { Box } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// ── PagesPanel ─────────────────────────────────────────────────────────────

export function PagesPanel() {
    const { pages, activePageId, switchPage, globalSettings, pagesLoading } = usePageStudio();
    const homepageSlug = globalSettings?.homepageSlug || 'home';

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 h-10 border-b border-neutral-800 flex items-center gap-2 flex-shrink-0">
                <span className="flex-1 font-bold text-sm text-neutral-200">Pages</span>
                <button
                    onClick={() => switchPage('create')}
                    className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                    title="New page"
                >
                    <Plus size={14} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
                {pagesLoading ? (
                    <div className="px-3 py-4 text-xs text-neutral-600">Loading...</div>
                ) : pages.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-neutral-600">No pages yet</div>
                ) : (
                    pages.map(page => {
                        const isActive = page.id === activePageId;
                        const isHome = page.slug === homepageSlug;
                        return (
                            <button
                                key={page.id}
                                onClick={() => switchPage(page.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                                    isActive
                                        ? 'bg-blue-500/10 text-blue-400'
                                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                                }`}
                            >
                                <FileText size={13} className="flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium truncate">
                                        {page.title || 'Untitled'}
                                    </div>
                                    <div className="text-xs text-neutral-600 truncate">
                                        /{page.slug}
                                    </div>
                                </div>
                                {isHome && <Home size={11} className="flex-shrink-0 text-neutral-500" />}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ── AddBlocksPanel ─────────────────────────────────────────────────────────

interface AddBlocksPanelProps {
    templateId?: string;
    onAfterAdd?: () => void; // Called after block is added (to switch to Navigator)
}

export function AddBlocksPanel({ templateId = 'classic', onAfterAdd }: AddBlocksPanelProps) {
    const { addBlock, setSelectedBlockId } = useEditor();
    const [moduleBlocks, setModuleBlocks] = useState<{ type: BlockType; label: string; icon: React.ElementType }[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'list';
        return (localStorage.getItem('canvas_studio_add_block_view') as 'list' | 'grid') || 'list';
    });

    useEffect(() => {
        localStorage.setItem('canvas_studio_add_block_view', viewMode);
    }, [viewMode]);

    useEffect(() => {
        const unsubscribe = subscribeToEnabledModules((modules) => {
            const dynamicBlocks: { type: BlockType; label: string; icon: React.ElementType }[] = [];
            modules.forEach(mod => {
                if (mod.blocks) {
                    mod.blocks.forEach(blockDef => {
                        const IconComponent = MODULE_ICONS[mod.icon] || Box;
                        dynamicBlocks.push({
                            type: blockDef.type,
                            label: blockDef.label,
                            icon: IconComponent
                        });
                    });
                }
            });
            setModuleBlocks(dynamicBlocks);
        });
        return () => unsubscribe();
    }, []);

    const handleAdd = useCallback((type: BlockType) => {
        const newBlock: PageBlock = {
            id: uuidv4(),
            type,
            data: getDefaultData(type, templateId)
        };
        addBlock(newBlock);
        setSelectedBlockId(newBlock.id);
        onAfterAdd?.();
    }, [addBlock, setSelectedBlockId, templateId, onAfterAdd]);

    const allOptions = [...BLOCK_OPTIONS, ...moduleBlocks];

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 h-10 border-b border-neutral-800 flex items-center flex-shrink-0">
                <span className="flex-1 font-bold text-sm text-neutral-200">Add Block</span>
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'text-white bg-neutral-700' : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'}`}
                    >
                        <LayoutList size={14} />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'text-white bg-neutral-700' : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'}`}
                    >
                        <LayoutGrid size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {viewMode === 'list' ? (
                    <div className="py-1">
                        {allOptions.map(opt => (
                            <button
                                key={opt.type}
                                onClick={() => handleAdd(opt.type)}
                                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-200"
                            >
                                <div className="p-1.5 bg-neutral-800 rounded text-neutral-400 flex-shrink-0">
                                    <opt.icon size={14} />
                                </div>
                                <span className="text-xs font-medium">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-x-2 gap-y-3 p-3">
                        {allOptions.map(opt => (
                            <button
                                key={opt.type}
                                onClick={() => handleAdd(opt.type)}
                                className="flex flex-col items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors group"
                            >
                                <div className="w-full aspect-square flex items-center justify-center bg-neutral-800 rounded-md group-hover:bg-neutral-700 transition-colors">
                                    <opt.icon size={20} />
                                </div>
                                <span className="text-[10px] font-medium text-center leading-tight">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

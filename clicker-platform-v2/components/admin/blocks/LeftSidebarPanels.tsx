'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Plus, FileText } from 'lucide-react';
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
                <span className="font-bold text-sm text-neutral-200">Add Block</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
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
        </div>
    );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Plus, FileText, LayoutList, LayoutGrid, Trash2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { usePageStudio } from './PageStudioContext';
import { useEditor } from './EditorContext';
import { BLOCK_OPTIONS, getDefaultData } from './blockDefinitions';
import { subscribeToEnabledModules, MODULE_ICONS } from '@/lib/modules/registry';
import { BlockType, PageBlock } from '@/data/mockData';
import { Box } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

// ── PagesPanel ─────────────────────────────────────────────────────────────

function formatDeletedAt(deletedAt: { toDate?: () => Date } | { toMillis?: () => number } | string | number | null | undefined): string {
    if (!deletedAt) return '';
    let date: Date;
    if (typeof deletedAt === 'object' && deletedAt !== null) {
        if ('toDate' in deletedAt && typeof deletedAt.toDate === 'function') date = deletedAt.toDate();
        else if ('toMillis' in deletedAt && typeof deletedAt.toMillis === 'function') date = new Date(deletedAt.toMillis());
        else date = new Date();
    } else {
        date = new Date(deletedAt as string | number);
    }
    const now = Date.now();
    const diff = now - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return date.toLocaleDateString();
}

export function PagesPanel() {
    const {
        pages, activePageId, switchPage, globalSettings, pagesLoading,
        trashPageById, trashedPages, trashedPagesLoading,
        loadTrashedPages, restorePage, restoreAllPages,
        permanentlyDeletePage, permanentlyDeleteAllPages,
    } = usePageStudio();
    const homepageSlug = globalSettings?.homepageSlug || 'home';

    // Inline trash confirmation
    const [confirmTrashId, setConfirmTrashId] = useState<string | null>(null);
    const [isTrashingId, setIsTrashingId] = useState<string | null>(null);

    // Trash section
    const [trashOpen, setTrashOpen] = useState(false);
    const [restoredSlugNotice, setRestoredSlugNotice] = useState<string | null>(null);
    const [pendingPermDeleteId, setPendingPermDeleteId] = useState<string | null>(null);
    const [pendingEmptyTrash, setPendingEmptyTrash] = useState(false);
    const [isRestoringId, setIsRestoringId] = useState<string | null>(null);
    const [isDeletingPermId, setIsDeletingPermId] = useState<string | null>(null);
    const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
    const [isRestoringAll, setIsRestoringAll] = useState(false);

    const handleToggleTrash = () => {
        if (!trashOpen) {
            loadTrashedPages();
        }
        setTrashOpen(prev => !prev);
    };

    const handleTrashClick = (e: React.MouseEvent, pageId: string) => {
        e.stopPropagation();
        setConfirmTrashId(pageId);
    };

    const confirmTrash = async (pageId: string) => {
        setConfirmTrashId(null);
        setIsTrashingId(pageId);
        await trashPageById(pageId);
        setIsTrashingId(null);
        if (trashOpen) loadTrashedPages();
    };

    const handleRestore = async (pageId: string) => {
        setIsRestoringId(pageId);
        const restoredSlug = await restorePage(pageId);
        const trashed = trashedPages.find(p => p.id === pageId);
        if (trashed && restoredSlug && restoredSlug !== trashed.slug) {
            setRestoredSlugNotice(`Restored as '/${restoredSlug}' — slug was already taken.`);
            setTimeout(() => setRestoredSlugNotice(null), 5000);
        }
        setIsRestoringId(null);
    };

    const handleRestoreAll = async () => {
        setIsRestoringAll(true);
        await restoreAllPages();
        setIsRestoringAll(false);
    };

    const confirmPermDelete = async () => {
        if (!pendingPermDeleteId) return;
        setIsDeletingPermId(pendingPermDeleteId);
        setPendingPermDeleteId(null);
        await permanentlyDeletePage(pendingPermDeleteId);
        setIsDeletingPermId(null);
    };

    const confirmEmptyTrash = async () => {
        setPendingEmptyTrash(false);
        setIsEmptyingTrash(true);
        await permanentlyDeleteAllPages();
        setIsEmptyingTrash(false);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 h-10 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2 flex-shrink-0">
                <span className="flex-1 font-bold text-sm text-neutral-900 dark:text-neutral-200">Pages</span>
                <button
                    onClick={() => switchPage('create')}
                    className="p-1.5 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    title="New page"
                >
                    <Plus size={14} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-1 flex flex-col">
                {/* Active pages list */}
                <div className="flex-1">
                    {pagesLoading ? (
                        <div className="px-3 py-4 text-xs text-neutral-400 dark:text-neutral-600">Loading...</div>
                    ) : pages.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-neutral-400 dark:text-neutral-600">No pages yet</div>
                    ) : (
                        [...pages].sort((a, b) => {
                            const aHome = a.slug === homepageSlug ? 0 : 1;
                            const bHome = b.slug === homepageSlug ? 0 : 1;
                            return aHome - bHome;
                        }).map((page, idx, sorted) => {
                            const isActive = page.id === activePageId;
                            const isHome = page.slug === homepageSlug;
                            const isTrashing = isTrashingId === page.id;
                            const isConfirming = confirmTrashId === page.id;
                            const showDivider = isHome && idx < sorted.length - 1;
                            return (
                                <div key={page.id} className="group relative">
                                    <div className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                                        isActive ? 'bg-blue-500/10' : 'hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    } ${isTrashing ? 'opacity-50' : ''}`}>
                                        <button
                                            onClick={() => !isConfirming && switchPage(page.id)}
                                            disabled={isTrashing}
                                            className={`flex-1 flex items-center gap-2 text-left min-w-0 ${
                                                isActive ? 'text-blue-400' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                                            }`}
                                        >
                                            <FileText size={13} className="flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium truncate">{page.title || 'Untitled'}</div>
                                                <div className="text-xs text-neutral-400 dark:text-neutral-600 truncate">/{page.slug}</div>
                                            </div>
                                            {isHome && <Home size={11} className="flex-shrink-0 text-neutral-400 dark:text-neutral-500" />}
                                        </button>
                                        {isConfirming ? (
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => confirmTrash(page.id)}
                                                    className="px-2 py-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-md hover:bg-red-500/20 transition-colors"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={() => setConfirmTrashId(null)}
                                                    className="px-2 py-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => handleTrashClick(e, page.id)}
                                                disabled={isTrashing}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-400 dark:text-neutral-600 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-30 flex-shrink-0"
                                                title="Move to Trash"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                    {showDivider && <div className="mx-3 mt-1 border-b border-gray-200 dark:border-neutral-800" />}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Restored slug notice */}
                {restoredSlugNotice && (
                    <div className="mx-3 my-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-400">
                        {restoredSlugNotice}
                    </div>
                )}

                {/* Trash section */}
                <div className="border-t border-gray-200 dark:border-neutral-800 mt-auto">
                    <button
                        onClick={handleToggleTrash}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        {trashOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <Trash2 size={12} />
                        <span className="flex-1 text-left font-medium">Trash</span>
                        {trashedPages.length > 0 && (
                            <span className="bg-gray-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 text-[10px] px-1.5 py-0.5 rounded-full">
                                {trashedPages.length}
                            </span>
                        )}
                    </button>

                    {trashOpen && (
                        <div className="pb-2">
                            {trashedPagesLoading ? (
                                <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-600">Loading...</div>
                            ) : trashedPages.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-600">Trash is empty</div>
                            ) : (
                                <>
                                    {/* Bulk actions */}
                                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                                        <button
                                            onClick={handleRestoreAll}
                                            disabled={isRestoringAll}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                                        >
                                            <RotateCcw size={10} />
                                            {isRestoringAll ? 'Restoring...' : 'Restore All'}
                                        </button>
                                        <button
                                            onClick={() => setPendingEmptyTrash(true)}
                                            disabled={isEmptyingTrash}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-red-500/70 hover:text-red-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={10} />
                                            {isEmptyingTrash ? 'Emptying...' : 'Empty Trash'}
                                        </button>
                                    </div>

                                    {/* Trashed page list */}
                                    {trashedPages.map(page => (
                                        <div key={page.id} className="group/trash px-3 py-1.5 flex items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-neutral-400 dark:text-neutral-500 truncate font-medium">{page.title || 'Untitled'}</div>
                                                <div className="text-[10px] text-neutral-500 dark:text-neutral-700 truncate">
                                                    /{page.slug} · {formatDeletedAt(page.deletedAt)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/trash:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleRestore(page.id)}
                                                    disabled={isRestoringId === page.id}
                                                    className="p-1 rounded text-neutral-400 dark:text-neutral-500 hover:text-green-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                                                    title="Restore"
                                                >
                                                    <RotateCcw size={11} />
                                                </button>
                                                <button
                                                    onClick={() => setPendingPermDeleteId(page.id)}
                                                    disabled={isDeletingPermId === page.id}
                                                    className="p-1 rounded text-neutral-400 dark:text-neutral-500 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                                                    title="Delete permanently"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm: permanently delete single */}
            <ConfirmationDialog
                isOpen={pendingPermDeleteId !== null}
                title="Delete Permanently?"
                message={`"${trashedPages.find(p => p.id === pendingPermDeleteId)?.title || 'This page'}" will be permanently deleted. This cannot be undone.`}
                confirmLabel="Delete Forever"
                isLoading={isDeletingPermId !== null}
                onConfirm={confirmPermDelete}
                onCancel={() => setPendingPermDeleteId(null)}
            />

            {/* Confirm: empty trash */}
            <ConfirmationDialog
                isOpen={pendingEmptyTrash}
                title="Empty Trash?"
                message={`Permanently delete all ${trashedPages.length} page${trashedPages.length !== 1 ? 's' : ''} in Trash? This cannot be undone.`}
                confirmLabel="Empty Trash"
                isLoading={isEmptyingTrash}
                onConfirm={confirmEmptyTrash}
                onCancel={() => setPendingEmptyTrash(false)}
            />
        </div>
    );
}

// ── AddBlocksPanel ─────────────────────────────────────────────────────────

interface AddBlocksPanelProps {
    templateId?: string;
    onAfterAdd?: () => void; // Called after block is added (to switch to Layers)
}

export function AddBlocksPanel({ templateId = 'classic', onAfterAdd }: AddBlocksPanelProps) {
    const { addBlock, setSelectedBlockId } = useEditor();
    const [moduleBlocks, setModuleBlocks] = useState<{ type: BlockType; label: string; icon: React.ElementType }[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'grid';
        return (localStorage.getItem('canvas_studio_add_block_view') as 'list' | 'grid') || 'grid';
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
                        const IconComponent = (MODULE_ICONS[mod.icon] || Box) as React.ElementType;
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
            <div className="px-3 h-10 border-b border-gray-200 dark:border-neutral-800 flex items-center flex-shrink-0">
                <span className="flex-1 font-bold text-sm text-neutral-900 dark:text-neutral-200">Add Block</span>
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'text-neutral-900 dark:text-white bg-gray-200 dark:bg-neutral-700' : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
                    >
                        <LayoutList size={14} />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'text-neutral-900 dark:text-white bg-gray-200 dark:bg-neutral-700' : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
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
                                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                            >
                                <div className="p-1.5 bg-gray-100 dark:bg-neutral-800 rounded text-neutral-500 dark:text-neutral-400 flex-shrink-0">
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
                                className="flex flex-col items-center gap-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors group"
                            >
                                <div className="w-full aspect-square flex items-center justify-center bg-gray-100 dark:bg-neutral-800 rounded-md group-hover:bg-gray-200 dark:group-hover:bg-neutral-700 transition-colors">
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

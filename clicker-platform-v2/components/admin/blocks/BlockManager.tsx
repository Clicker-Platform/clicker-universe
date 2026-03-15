'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageBlock, BlockType } from '@/data/mockData';
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
import { Plus, Type, Image as ImageIcon, Layout, Box, HelpCircle, AlignCenter, Link, Map, Lock, List, Clock, Star, MapPin } from 'lucide-react';
import { BlockOutlineItem } from './BlockOutlineItem';
import { useEditor } from './EditorContext';
import { v4 as uuidv4 } from 'uuid';

import { subscribeToEnabledModules, MODULE_ICONS } from '@/lib/modules/registry';

interface BlockManagerProps {
    blocks: PageBlock[];
    onChange: (blocks: PageBlock[]) => void;
    templateId?: string;
}

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { getTemplate } from '@/lib/templates/registry';

export const BlockManager = ({ blocks, onChange, templateId = 'classic' }: BlockManagerProps) => {
    const { selectedBlockId, setSelectedBlockId } = useEditor();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
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

    const getDefaultData = (type: BlockType): any => {
        const template = getTemplate(templateId);
        const defaultLayoutVariant = template.config.defaultBlockLayouts?.[type];
        const baseData: any = {};
        
        if (defaultLayoutVariant) {
            baseData.layoutVariant = defaultLayoutVariant;
        }

        switch (type) {
            case 'hero':
                return { ...baseData, title: 'Your Headline', subtitle: 'Your subtitle goes here' };
            case 'text':
                return { ...baseData, content: '<p>Start writing your content here...</p>' };
            case 'image':
                return { ...baseData, alt: 'Image description', caption: '' };
            case 'button':
                return { ...baseData, label: 'Click Me', url: '#', style: 'primary' };
            case 'products':
                return { ...baseData, title: 'Our Products' };
            case 'faq':
                return { ...baseData, title: 'Frequently Asked Questions', items: [{ question: 'Sample question?', answer: 'Sample answer.' }] };
            case 'link':
                return { ...baseData, title: 'Link Title', url: '#' };
            case 'map':
                return { ...baseData, address: 'Your address here' };
            case 'image_gallery':
                return { ...baseData, title: 'Gallery', images: [] };
            case 'quick_actions':
            case 'hours':
            case 'branches':
            case 'featured_product':
                return baseData; // System blocks hydrate from global data
            default:
                return baseData;
        }
    };

    const addBlock = useCallback((type: BlockType) => {
        const newBlock: PageBlock = {
            id: uuidv4(),
            type,
            data: getDefaultData(type)
        };
        onChange([...blocks, newBlock]);
        setSelectedBlockId?.(newBlock.id); // Auto-select the new block
        setIsMenuOpen(false);
    }, [blocks, onChange, setSelectedBlockId]);

    const updateBlock = useCallback((id: string, data: any) => {
        // We use a functional update pattern simulation or just rely on blocks prop
        // Ideally, we shouldn't depend on 'blocks' for updateBlock if possible to avoid re-creating this function
        // But since we need to map over blocks, we do need it, unless we use a functional state update from parent.
        // The parent (PageEditor) just holds state.

        // BETTER: Create a new array.
        const newBlocks = blocks.map(b => b.id === id ? { ...b, data } : b);
        onChange(newBlocks);
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

    const BLOCK_OPTIONS: { type: BlockType; label: string; icon: React.ElementType }[] = useMemo(() => [
        { type: 'hero', label: 'Hero Section', icon: Layout },
        { type: 'text', label: 'Text Content', icon: Type },
        { type: 'image', label: 'Image', icon: ImageIcon },
        { type: 'button', label: 'Button', icon: Box }, // Box icon for button/block
        { type: 'products', label: 'Product List', icon: AlignCenter }, // AlignCenter as placeholder list
        { type: 'faq', label: 'FAQ List', icon: HelpCircle },
        { type: 'link', label: 'Link Card', icon: Link },
        { type: 'map', label: 'Map', icon: Map },
        { type: 'image_gallery', label: 'Image Gallery', icon: ImageIcon },
        { type: 'quick_actions', label: 'Quick Links', icon: List },
        { type: 'hours', label: 'Operating Hours', icon: Clock },
        { type: 'featured_product', label: 'Featured Product', icon: Star },
        { type: 'branches', label: 'Branches', icon: MapPin },
    ], []);

    const allBlockOptions = useMemo(() => [...BLOCK_OPTIONS, ...moduleBlocks], [BLOCK_OPTIONS, moduleBlocks]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-200">Page Blocks</h3>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-2 bg-neutral-800 text-neutral-200 border border-neutral-700 px-4 py-2 rounded-xl font-bold hover:bg-neutral-700 transition-colors shadow-sm"
                    >
                        <Plus size={18} /> Add
                    </button>

                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-neutral-800 rounded-xl shadow-2xl border border-neutral-700 p-2 z-20 grid gap-1 max-h-80 overflow-y-auto custom-scrollbar">
                                {allBlockOptions.map((opt) => (
                                    <button
                                        key={opt.type}
                                        type="button"
                                        onClick={() => addBlock(opt.type)}
                                        className="flex items-center gap-3 w-full p-2 hover:bg-neutral-700 rounded-lg text-left transition-colors text-neutral-300 font-medium"
                                    >
                                        <div className="p-1.5 bg-neutral-700 rounded text-neutral-200">
                                            <opt.icon size={16} />
                                        </div>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Pinned Header */}
                <div 
                    className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedBlockId === 'chrome:header' 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-medium shadow-lg' 
                        : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200'
                    }`}
                    onClick={() => setSelectedBlockId?.('chrome:header')}
                >
                    <div className="p-1 rounded text-neutral-500">
                        <Lock size={16} />
                    </div>
                    <div className="flex-1 flex items-center gap-2 text-sm">
                        <span className="truncate font-bold">Header Navigation</span>
                    </div>
                </div>

                <div className="relative pl-3 border-l-2 border-dashed border-neutral-800 my-2">
                    {blocks.length === 0 ? (
                        <div className="text-center py-8 bg-neutral-800/50 rounded-2xl border-2 border-dashed border-neutral-700">
                            <p className="text-neutral-500 mb-4 text-sm">Start building your page by adding blocks</p>
                            <button
                                type="button"
                                onClick={() => setIsMenuOpen(true)}
                                className="text-blue-400 font-bold hover:text-blue-300 transition-colors text-sm"
                            >
                                + Add your first block
                            </button>
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
                                <div className="space-y-1">
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
                    className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedBlockId === 'chrome:footer' 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-medium shadow-lg' 
                        : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200'
                    }`}
                    onClick={() => setSelectedBlockId?.('chrome:footer')}
                >
                    <div className="p-1 rounded text-neutral-500">
                        <Lock size={16} />
                    </div>
                    <div className="flex-1 flex items-center gap-2 text-sm">
                        <span className="truncate font-bold">Site Footer</span>
                    </div>
                </div>
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

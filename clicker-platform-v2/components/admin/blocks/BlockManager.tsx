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
import { Plus, Type, Image as ImageIcon, Layout, Box, HelpCircle, AlignCenter, Link, Map } from 'lucide-react';
import { BlockEditor } from './BlockEditor';
import { v4 as uuidv4 } from 'uuid';

import { subscribeToEnabledModules, MODULE_ICONS } from '@/lib/modules/registry';

interface BlockManagerProps {
    blocks: PageBlock[];
    onChange: (blocks: PageBlock[]) => void;
}

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

export const BlockManager = ({ blocks, onChange }: BlockManagerProps) => {
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

    const addBlock = useCallback((type: BlockType) => {
        const newBlock: PageBlock = {
            id: uuidv4(),
            type,
            data: {} // In a real app we might set default data here
        };
        onChange([...blocks, newBlock]);
        setIsMenuOpen(false);
    }, [blocks, onChange]);

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
    ], []);

    const allBlockOptions = useMemo(() => [...BLOCK_OPTIONS, ...moduleBlocks], [BLOCK_OPTIONS, moduleBlocks]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">Page Blocks</h3>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold hover:bg-black transition-colors"
                    >
                        <Plus size={18} /> Add Block
                    </button>

                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-20 grid gap-1 max-h-80 overflow-y-auto">
                                {allBlockOptions.map((opt) => (
                                    <button
                                        key={opt.type}
                                        type="button"
                                        onClick={() => addBlock(opt.type)}
                                        className="flex items-center gap-3 w-full p-2 hover:bg-gray-50 rounded-lg text-left transition-colors text-gray-700 font-medium"
                                    >
                                        <div className="p-1.5 bg-gray-100 rounded text-brand-dark">
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

            {blocks.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 mb-4">Start building your page by adding blocks</p>
                    <button
                        type="button"
                        onClick={() => setIsMenuOpen(true)}
                        className="text-brand-dark font-bold hover:underline"
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
                        <div>
                            {blocks.map(block => (
                                <BlockEditor
                                    key={block.id}
                                    block={block}
                                    onChange={updateBlock}
                                    onDelete={deleteBlock}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

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

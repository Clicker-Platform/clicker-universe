'use client';

import { PageBlock } from '@/data/mockData';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Box } from 'lucide-react';
import { memo } from 'react';

// Shared utility to get a readable label for a block type
export const getBlockLabel = (type: string, moduleInfoName?: string) => {
    if (moduleInfoName) return moduleInfoName;
    const coreLabels: Record<string, string> = {
        'hero': 'Hero Section',
        'text': 'Text Content',
        'image': 'Image',
        'button': 'Button',
        'products': 'Product List',
        'faq': 'FAQ List',
        'link': 'Link Card',
        'map': 'Map Location',
        'image_gallery': 'Image Gallery',
        'quick_actions': 'Quick Actions',
        'hours': 'Operating Hours',
        'featured_product': 'Featured Product',
        'branches': 'Branches',
        'social_embed': 'Social Embeds'
    };
    return coreLabels[type] || `Module (${type})`;
};

interface BlockOutlineItemProps {
    block: PageBlock;
    isSelected: boolean;
    onClick: () => void;
    onDelete: (id: string) => void;
}

export const BlockOutlineItem = memo(({ block, isSelected, onClick, onDelete }: BlockOutlineItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors group ${
                isSelected
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
            onClick={onClick}
        >
            <div
                {...attributes}
                {...listeners}
                className="p-0.5 rounded cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={13} />
            </div>

            <Box size={13} className={`flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}`} />

            <span className="flex-1 text-xs font-medium truncate">{getBlockLabel(block.type)}</span>

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(block.id);
                }}
                className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 flex-shrink-0"
                title="Delete block"
            >
                <Trash2 size={12} />
            </button>
        </div>
    );
});

BlockOutlineItem.displayName = 'BlockOutlineItem';

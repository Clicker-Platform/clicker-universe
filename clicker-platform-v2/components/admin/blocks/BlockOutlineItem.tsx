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
        'branches': 'Branches'
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
            className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all border group ${
                isSelected 
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-medium shadow-lg' 
                : 'bg-neutral-800 border-transparent hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200'
            }`}
            onClick={onClick}
        >
            <div 
                {...attributes} 
                {...listeners} 
                className={`p-1 rounded cursor-grab active:cursor-grabbing hover:bg-neutral-600 transition-colors ${isSelected ? 'text-blue-400' : 'text-neutral-500'}`}
                onClick={(e) => e.stopPropagation()} // Prevent clicking the drag handle from selecting
            >
                <GripVertical size={16} />
            </div>
            
            <div className="flex-1 flex items-center gap-2 text-sm truncate">
                <Box size={14} className={isSelected ? 'text-blue-400' : 'text-neutral-500'} />
                <span className="truncate">{getBlockLabel(block.type)}</span>
            </div>

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(block.id);
                }}
                className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                title="Delete block"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
});

BlockOutlineItem.displayName = 'BlockOutlineItem';

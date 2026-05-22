'use client';

import { PageBlock } from '@/data/mockData';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Box } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useEditor } from './EditorContext';

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
        'social_embed': 'Social Embeds',
        'content_showcase': 'Content Showcase',
        'feature_cards': 'Feature Cards'
    };
    return coreLabels[type] || `Module (${type})`;
};

interface BlockOutlineItemProps {
    block: PageBlock;
    isSelected: boolean;
    onClick: () => void;
    onDelete: (id: string) => void;
    moduleLabel?: string;
}

export const BlockOutlineItem = memo(({ block, isSelected, onClick, onDelete, moduleLabel }: BlockOutlineItemProps) => {
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

    const { updateBlockData } = useEditor();
    const defaultLabel = getBlockLabel(block.type, moduleLabel);
    const displayLabel = block.data?.label?.trim() || defaultLabel;

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(displayLabel);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const commit = () => {
        const next = draft.trim();
        const current = block.data?.label?.trim() || '';
        if (next === defaultLabel) {
            if (current) updateBlockData(block.id, { label: '' });
        } else if (next !== current) {
            updateBlockData(block.id, { label: next });
        }
        setIsEditing(false);
    };

    const cancel = () => {
        setDraft(displayLabel);
        setIsEditing(false);
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
                className="p-2 -m-1 rounded cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors flex-shrink-0 touch-none"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={15} />
            </div>

            <Box size={13} className={`flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}`} />

            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancel();
                        }
                    }}
                    className="flex-1 min-w-0 text-xs font-medium bg-white dark:bg-neutral-900 border border-blue-500 rounded px-1 py-0.5 text-neutral-900 dark:text-neutral-100 outline-none"
                />
            ) : (
                <span
                    className="flex-1 text-xs font-medium truncate"
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setDraft(displayLabel);
                        setIsEditing(true);
                    }}
                    title="Double-click to rename"
                >
                    {displayLabel}
                </span>
            )}

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

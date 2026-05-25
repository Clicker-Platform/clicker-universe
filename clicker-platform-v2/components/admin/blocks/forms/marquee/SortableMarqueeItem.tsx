'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Star } from 'lucide-react';
import { ICON_MAP } from '@/data/icons';
import { MarqueeItem } from '@/components/blocks/marquee/types';
import { SafeSvgIcon } from '@/components/blocks/public/SafeSvgIcon';
import { IconKindPopover } from './IconKindPopover';

interface SortableMarqueeItemProps {
    item: MarqueeItem;
    onChange: (next: MarqueeItem) => void;
    onDelete: () => void;
}

export const SortableMarqueeItem: React.FC<SortableMarqueeItemProps> = ({ item, onChange, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const renderIconPreview = () => {
        if (item.icon.kind === 'svg') {
            return <SafeSvgIcon svg={item.icon.svg} className="text-gray-700 dark:text-neutral-300" />;
        }
        const Icon = ICON_MAP[item.icon.name] ?? Star;
        return <Icon size={18} className="text-gray-700 dark:text-neutral-300" />;
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 p-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md">
                <button type="button" {...attributes} {...listeners} className="cursor-grab text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300" aria-label="Drag to reorder">
                    <GripVertical size={16} />
                </button>

                <IconKindPopover
                    icon={item.icon}
                    onChange={(nextIcon) => onChange({ ...item, icon: nextIcon })}
                    trigger={
                        <button type="button" className="flex items-center justify-center w-8 h-8 border border-gray-200 dark:border-neutral-700 rounded hover:bg-gray-50 dark:hover:bg-neutral-700" aria-label="Change icon">
                            {renderIconPreview()}
                        </button>
                    }
                />

                <input
                    type="text"
                    value={item.label}
                    onChange={(e) => onChange({ ...item, label: e.target.value })}
                    placeholder="Label"
                    className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:placeholder-neutral-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>

            <button type="button" onClick={onDelete} className="shrink-0 p-1 text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400" aria-label="Delete item">
                <Trash2 size={16} />
            </button>
        </div>
    );
};

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
            return <SafeSvgIcon svg={item.icon.svg} className="text-gray-700" />;
        }
        const Icon = ICON_MAP[item.icon.name] ?? Star;
        return <Icon size={18} className="text-gray-700" />;
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-md">
            <button type="button" {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600" aria-label="Drag to reorder">
                <GripVertical size={16} />
            </button>

            <IconKindPopover
                icon={item.icon}
                onChange={(nextIcon) => onChange({ ...item, icon: nextIcon })}
                trigger={
                    <button type="button" className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded hover:bg-gray-50" aria-label="Change icon">
                        {renderIconPreview()}
                    </button>
                }
            />

            <input
                type="text"
                value={item.label}
                onChange={(e) => onChange({ ...item, label: e.target.value })}
                placeholder="Label"
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <button type="button" onClick={onDelete} className="text-gray-400 hover:text-red-500" aria-label="Delete item">
                <Trash2 size={16} />
            </button>
        </div>
    );
};

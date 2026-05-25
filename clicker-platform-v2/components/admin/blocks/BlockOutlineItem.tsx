'use client';

import { PageBlock } from '@/data/mockData';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Box, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { useEditor } from './EditorContext';
import { ConfirmButton } from '@/components/ui/ConfirmButton';

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
        'feature_cards': 'Feature Cards',
        'columns': 'Columns',
        'grid': 'Grid',
        'heading': 'Heading',
        'marquee': 'Marquee',
        'testimonials': 'Testimonials',
        'inline_form': 'Inline Form',
    };
    return coreLabels[type] || `Module (${type})`;
};

// Lower-level row used by both the top-level sortable items and the nested
// tree rows. Caller provides the drag handle via `dragHandle` or omits it
// for non-sortable rows.
interface BlockOutlineRowProps {
    block: PageBlock;
    isSelected: boolean;
    onClick: () => void;
    onDelete?: (id: string) => void;
    onToggleHidden?: (id: string) => void;
    moduleLabel?: string;
    depth?: number;
    expandable?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
    dragHandle?: ReactNode;
}

export const BlockOutlineRow = memo(({
    block,
    isSelected,
    onClick,
    onDelete,
    onToggleHidden,
    moduleLabel,
    depth = 0,
    expandable = false,
    expanded = false,
    onToggleExpand,
    dragHandle,
}: BlockOutlineRowProps) => {
    const { updateBlockData } = useEditor();
    const defaultLabel = getBlockLabel(block.type, moduleLabel);
    const displayLabel = block.data?.label?.trim() || defaultLabel;

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(displayLabel);
    const inputRef = useRef<HTMLInputElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    useEffect(() => {
        if (isSelected) {
            rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [isSelected]);

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
            ref={rowRef}
            className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors group ${
                isSelected
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
            style={{ paddingLeft: depth > 0 ? 8 + depth * 12 : undefined }}
            onClick={onClick}
        >
            {dragHandle}

            {expandable ? (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
                    className="p-0.5 -m-0.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 flex-shrink-0"
                >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
            ) : (
                <span className="w-3 flex-shrink-0" />
            )}

            <Box size={13} className={`flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-neutral-400 dark:text-neutral-500'} ${block.hidden ? 'opacity-40' : ''}`} />

            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commit(); }
                        else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                    }}
                    className="flex-1 min-w-0 text-xs font-medium bg-white dark:bg-neutral-900 border border-blue-500 rounded px-1 py-0.5 text-neutral-900 dark:text-neutral-100 outline-none"
                />
            ) : (
                <span
                    className={`flex-1 text-xs font-medium truncate ${block.hidden ? 'opacity-40' : ''}`}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setDraft(displayLabel);
                        setIsEditing(true);
                    }}
                    title={block.hidden ? 'Hidden — double-click to rename' : 'Double-click to rename'}
                >
                    {displayLabel}
                </span>
            )}

            {onToggleHidden && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleHidden(block.id); }}
                    className={`w-5 h-5 inline-flex items-center justify-center rounded transition-all flex-shrink-0 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 ${
                        block.hidden
                            ? 'text-neutral-500 dark:text-neutral-400 opacity-100 hover:text-neutral-700 dark:hover:text-neutral-200'
                            : 'text-neutral-400 dark:text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }`}
                    title={block.hidden ? 'Show block' : 'Hide block'}
                >
                    {block.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
            )}

            {onDelete && (
                <span
                    className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ConfirmButton
                        onConfirm={() => onDelete(block.id)}
                        iconOnly
                        triggerIcon={<Trash2 size={12} />}
                        triggerTitle="Delete block"
                        triggerClassName="w-5 h-5 inline-flex items-center justify-center rounded text-neutral-400 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                        confirmClassName="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-600 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30 hover:bg-red-200 dark:hover:bg-red-500/25 transition-colors"
                        cancelClassName="px-1.5 py-0.5 text-[10px] rounded border border-gray-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                    />
                </span>
            )}
        </div>
    );
});

BlockOutlineRow.displayName = 'BlockOutlineRow';

// Top-level sortable wrapper around BlockOutlineRow. Keeps the existing
// grip handle and rename/delete behaviour for the page's primary block list.
interface BlockOutlineItemProps {
    block: PageBlock;
    isSelected: boolean;
    onClick: () => void;
    onDelete: (id: string) => void;
    onToggleHidden?: (id: string) => void;
    moduleLabel?: string;
    expandable?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
}

export const BlockOutlineItem = memo(({
    block,
    isSelected,
    onClick,
    onDelete,
    onToggleHidden,
    moduleLabel,
    expandable,
    expanded,
    onToggleExpand,
}: BlockOutlineItemProps) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const dragHandle = (
        <div
            {...attributes}
            {...listeners}
            className="p-2 -m-1 rounded cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors flex-shrink-0 touch-none"
            onClick={(e) => e.stopPropagation()}
        >
            <GripVertical size={15} />
        </div>
    );

    return (
        <div ref={setNodeRef} style={style}>
            <BlockOutlineRow
                block={block}
                isSelected={isSelected}
                onClick={onClick}
                onDelete={onDelete}
                onToggleHidden={onToggleHidden}
                moduleLabel={moduleLabel}
                expandable={expandable}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                dragHandle={dragHandle}
            />
        </div>
    );
});

BlockOutlineItem.displayName = 'BlockOutlineItem';

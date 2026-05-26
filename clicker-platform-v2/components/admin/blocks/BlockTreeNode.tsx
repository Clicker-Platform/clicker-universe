'use client';

import { useEffect, useRef, useState } from 'react';
import { PageBlock } from '@/data/mockData';
import { LayoutGrid, Columns as ColumnsIcon, Square, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditor } from './EditorContext';
import { BlockOutlineItem, BlockOutlineRow } from './BlockOutlineItem';
import { getBlockChildren } from './blockTreeChildren';

interface SharedTreeProps {
    moduleBlockLabels: Record<string, string>;
    onDelete: (id: string) => void;
    onToggleHidden: (id: string) => void;
    /** Set of node IDs (block.id or slot.id) currently collapsed. Default: expanded. */
    collapsedIds: Set<string>;
    onToggleCollapsed: (id: string) => void;
    /** Rename a column slot or grid cell. Empty string clears the custom label. */
    onRenameSlot: (slotId: string, nextLabel: string) => void;
}

interface BlockTreeNodeProps extends SharedTreeProps {
    block: PageBlock;
    depth: number;
}

export function BlockTreeNode({
    block,
    depth,
    moduleBlockLabels,
    onDelete,
    onToggleHidden,
    collapsedIds,
    onToggleCollapsed,
    onRenameSlot,
}: BlockTreeNodeProps) {
    const { selection, setSelection } = useEditor();
    const expanded = !collapsedIds.has(block.id);

    const children = getBlockChildren(block);
    const expandable = children.kind !== 'leaf';

    // Highlight when this block is directly selected OR when something inside
    // it (a card, an empty slot) is selected, so the outline tracks "where am I".
    const isSelected =
        (selection.kind === 'blocks' && selection.ids.includes(block.id)) ||
        (selection.kind === 'slots' && selection.containerId === block.id);

    const onClickBlock = () => setSelection({ kind: 'blocks', ids: [block.id] });
    const toggle = () => onToggleCollapsed(block.id);

    const Row = depth === 0 ? (
        <BlockOutlineItem
            block={block}
            isSelected={isSelected}
            onClick={onClickBlock}
            onDelete={onDelete}
            onToggleHidden={onToggleHidden}
            moduleLabel={moduleBlockLabels[block.type]}
            expandable={expandable}
            expanded={expanded}
            onToggleExpand={toggle}
        />
    ) : (
        <BlockOutlineRow
            block={block}
            isSelected={isSelected}
            onClick={onClickBlock}
            onDelete={onDelete}
            onToggleHidden={onToggleHidden}
            moduleLabel={moduleBlockLabels[block.type]}
            depth={depth}
            expandable={expandable}
            expanded={expanded}
            onToggleExpand={toggle}
        />
    );

    return (
        <>
            {Row}
            {expanded && children.kind === 'columns' && children.slots.map(slot => (
                <ColumnsSlotNode
                    key={slot.id}
                    containerId={block.id}
                    slot={slot}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                    onToggleHidden={onToggleHidden}
                    collapsedIds={collapsedIds}
                    onToggleCollapsed={onToggleCollapsed}
                    onRenameSlot={onRenameSlot}
                />
            ))}
            {expanded && children.kind === 'grid' && children.slots.map(slot => (
                <GridSlotNode
                    key={slot.id}
                    containerId={block.id}
                    slot={slot}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                    onToggleHidden={onToggleHidden}
                    collapsedIds={collapsedIds}
                    onToggleCollapsed={onToggleCollapsed}
                    onRenameSlot={onRenameSlot}
                />
            ))}
            {expanded && children.kind === 'feature_cards' && children.cards.map((card, i) => (
                <CardLeafNode
                    key={card.id}
                    containerId={block.id}
                    cardId={card.id}
                    label={card.label}
                    defaultLabel={card.defaultLabel}
                    index={i}
                    depth={depth + 1}
                    onRename={onRenameSlot}
                />
            ))}
        </>
    );
}

// ─── Slot nodes ────────────────────────────────────────────────────────────

function SlotRow({
    containerId,
    slotId,
    label,
    defaultLabel,
    depth,
    icon,
    expandable = false,
    expanded = false,
    onToggleExpand,
    onRename,
    prefixLabel,
}: {
    containerId: string;
    slotId: string;
    label: string;
    defaultLabel: string;
    depth: number;
    icon: React.ReactNode;
    expandable?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
    onRename?: (slotId: string, nextLabel: string) => void;
    /** Optional prefix shown before the label (e.g., "#1") when not editing. */
    prefixLabel?: string;
}) {
    const { selection, setSelection } = useEditor();
    const isSelected =
        selection.kind === 'slots'
        && selection.containerId === containerId
        && selection.ids.includes(slotId);

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(label);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const commit = () => {
        if (!onRename) { setIsEditing(false); return; }
        const next = draft.trim();
        // Empty or equal to default → clear so navigator falls back to default.
        // Same custom label → no-op.
        if (next === '' || next === defaultLabel) {
            if (label !== defaultLabel) onRename(slotId, '');
        } else if (next !== label) {
            onRename(slotId, next);
        }
        setIsEditing(false);
    };

    const cancel = () => {
        setDraft(label);
        setIsEditing(false);
    };

    return (
        <div
            className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors text-xs ${
                isSelected
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
            }`}
            style={{ paddingLeft: 8 + depth * 12 }}
            onClick={() => setSelection({ kind: 'slots', containerId, ids: [slotId] })}
        >
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
            {icon}
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
                    placeholder={defaultLabel}
                    className="flex-1 min-w-0 text-xs font-medium bg-white dark:bg-neutral-900 border border-blue-500 rounded px-1 py-0.5 text-neutral-900 dark:text-neutral-100 outline-none"
                />
            ) : (
                <span
                    className="flex-1 truncate font-medium"
                    onDoubleClick={onRename ? (e) => {
                        e.stopPropagation();
                        setDraft(label);
                        setIsEditing(true);
                    } : undefined}
                    title={onRename ? 'Double-click to rename' : undefined}
                >
                    {prefixLabel && <span className="opacity-50 mr-1">{prefixLabel}</span>}
                    {label}
                </span>
            )}
        </div>
    );
}

interface ColumnsSlotNodeProps extends SharedTreeProps {
    containerId: string;
    slot: { id: string; label: string; defaultLabel: string; blocks: PageBlock[] };
    depth: number;
}

function ColumnsSlotNode({
    containerId, slot, depth, moduleBlockLabels, onDelete, onToggleHidden, collapsedIds, onToggleCollapsed, onRenameSlot,
}: ColumnsSlotNodeProps) {
    const expanded = !collapsedIds.has(slot.id);
    const hasChildren = slot.blocks.length > 0;
    return (
        <>
            <SlotRow
                containerId={containerId}
                slotId={slot.id}
                label={slot.label}
                defaultLabel={slot.defaultLabel}
                depth={depth}
                icon={<ColumnsIcon size={11} className="flex-shrink-0 opacity-60" />}
                expandable={hasChildren}
                expanded={expanded}
                onToggleExpand={() => onToggleCollapsed(slot.id)}
                onRename={onRenameSlot}
            />
            {expanded && slot.blocks.map(child => (
                <BlockTreeNode
                    key={child.id}
                    block={child}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                    onToggleHidden={onToggleHidden}
                    collapsedIds={collapsedIds}
                    onToggleCollapsed={onToggleCollapsed}
                    onRenameSlot={onRenameSlot}
                />
            ))}
        </>
    );
}

interface GridSlotNodeProps extends SharedTreeProps {
    containerId: string;
    slot: { id: string; label: string; defaultLabel: string; block: PageBlock | null };
    depth: number;
}

function GridSlotNode({
    containerId, slot, depth, moduleBlockLabels, onDelete, onToggleHidden, collapsedIds, onToggleCollapsed, onRenameSlot,
}: GridSlotNodeProps) {
    const expanded = !collapsedIds.has(slot.id);
    const hasChildren = !!slot.block;
    return (
        <>
            <SlotRow
                containerId={containerId}
                slotId={slot.id}
                label={slot.label}
                defaultLabel={slot.defaultLabel}
                depth={depth}
                icon={<LayoutGrid size={11} className="flex-shrink-0 opacity-60" />}
                expandable={hasChildren}
                expanded={expanded}
                onToggleExpand={() => onToggleCollapsed(slot.id)}
                onRename={onRenameSlot}
            />
            {expanded && slot.block && (
                <BlockTreeNode
                    block={slot.block}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                    onToggleHidden={onToggleHidden}
                    collapsedIds={collapsedIds}
                    onToggleCollapsed={onToggleCollapsed}
                    onRenameSlot={onRenameSlot}
                />
            )}
        </>
    );
}

function CardLeafNode({
    containerId, cardId, label, defaultLabel, index, depth, onRename,
}: {
    containerId: string;
    cardId: string;
    label: string;
    defaultLabel: string;
    index: number;
    depth: number;
    onRename?: (slotId: string, nextLabel: string) => void;
}) {
    return (
        <SlotRow
            containerId={containerId}
            slotId={cardId}
            label={label}
            defaultLabel={defaultLabel}
            depth={depth}
            icon={<Square size={11} className="flex-shrink-0 opacity-60" />}
            onRename={onRename}
            prefixLabel={`#${index + 1}`}
        />
    );
}

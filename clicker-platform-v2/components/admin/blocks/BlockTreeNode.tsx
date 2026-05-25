'use client';

import { useState } from 'react';
import { PageBlock } from '@/data/mockData';
import { LayoutGrid, Columns as ColumnsIcon, Square } from 'lucide-react';
import { useEditor } from './EditorContext';
import { BlockOutlineItem, BlockOutlineRow } from './BlockOutlineItem';
import { getBlockChildren } from './blockTreeChildren';

interface BlockTreeNodeProps {
    block: PageBlock;
    depth: number;
    moduleBlockLabels: Record<string, string>;
    onDelete: (id: string) => void;
}

export function BlockTreeNode({ block, depth, moduleBlockLabels, onDelete }: BlockTreeNodeProps) {
    const { selection, setSelection } = useEditor();
    const [expanded, setExpanded] = useState(true);

    const children = getBlockChildren(block);
    const expandable = children.kind !== 'leaf';

    // Highlight when this block is directly selected OR when something inside
    // it (a card, an empty slot) is selected, so the outline tracks "where am I".
    const isSelected =
        (selection.kind === 'blocks' && selection.ids.includes(block.id)) ||
        (selection.kind === 'slots' && selection.containerId === block.id);

    const onClickBlock = () => setSelection({ kind: 'blocks', ids: [block.id] });
    const toggle = () => setExpanded(e => !e);

    const Row = depth === 0 ? (
        <BlockOutlineItem
            block={block}
            isSelected={isSelected}
            onClick={onClickBlock}
            onDelete={onDelete}
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
                />
            ))}
            {expanded && children.kind === 'feature_cards' && children.cards.map((card, i) => (
                <CardLeafNode
                    key={card.id}
                    containerId={block.id}
                    cardId={card.id}
                    label={card.label}
                    index={i}
                    depth={depth + 1}
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
    depth,
    icon,
}: {
    containerId: string;
    slotId: string;
    label: string;
    depth: number;
    icon: React.ReactNode;
}) {
    const { selection, setSelection } = useEditor();
    const isSelected =
        selection.kind === 'slots'
        && selection.containerId === containerId
        && selection.ids.includes(slotId);

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
            <span className="w-3 flex-shrink-0" />
            {icon}
            <span className="flex-1 truncate font-medium">{label}</span>
        </div>
    );
}

function ColumnsSlotNode({
    containerId, slot, depth, moduleBlockLabels, onDelete,
}: {
    containerId: string;
    slot: { id: string; label: string; blocks: PageBlock[] };
    depth: number;
    moduleBlockLabels: Record<string, string>;
    onDelete: (id: string) => void;
}) {
    return (
        <>
            <SlotRow
                containerId={containerId}
                slotId={slot.id}
                label={slot.label}
                depth={depth}
                icon={<ColumnsIcon size={11} className="flex-shrink-0 opacity-60" />}
            />
            {slot.blocks.map(child => (
                <BlockTreeNode
                    key={child.id}
                    block={child}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                />
            ))}
        </>
    );
}

function GridSlotNode({
    containerId, slot, depth, moduleBlockLabels, onDelete,
}: {
    containerId: string;
    slot: { id: string; label: string; block: PageBlock | null };
    depth: number;
    moduleBlockLabels: Record<string, string>;
    onDelete: (id: string) => void;
}) {
    return (
        <>
            <SlotRow
                containerId={containerId}
                slotId={slot.id}
                label={slot.label}
                depth={depth}
                icon={<LayoutGrid size={11} className="flex-shrink-0 opacity-60" />}
            />
            {slot.block && (
                <BlockTreeNode
                    block={slot.block}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                />
            )}
        </>
    );
}

function CardLeafNode({
    containerId, cardId, label, index, depth,
}: {
    containerId: string;
    cardId: string;
    label: string;
    index: number;
    depth: number;
}) {
    const { selection, setSelection } = useEditor();
    const isSelected =
        selection.kind === 'slots'
        && selection.containerId === containerId
        && selection.ids.includes(cardId);

    return (
        <div
            className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors text-xs ${
                isSelected
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
            }`}
            style={{ paddingLeft: 8 + depth * 12 }}
            onClick={() => setSelection({ kind: 'slots', containerId, ids: [cardId] })}
        >
            <span className="w-3 flex-shrink-0" />
            <Square size={11} className="flex-shrink-0 opacity-60" />
            <span className="flex-1 truncate"><span className="opacity-50 mr-1">#{index + 1}</span>{label}</span>
        </div>
    );
}

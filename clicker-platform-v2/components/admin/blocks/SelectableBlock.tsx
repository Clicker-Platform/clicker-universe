'use client';

import React, { ReactNode, useContext } from 'react';
import { EditorContext } from './EditorContext';
import { SelectionChrome } from './SelectionChrome';

interface InlineFieldFocusPayload {
    blockId: string;
    field: string;
    rect: DOMRect;
    currentData: any;
}

interface SelectableBlockProps {
    /** Block id. The block becomes "selected" when this matches editor.selectedBlockId. */
    blockId: string;
    /** Block type — controls pointer-events behavior for inline-editable / iframe blocks. */
    blockType: string;
    /** Block data — passed to onInlineFocus so caller can stash it for inline editing. */
    blockData?: any;
    /** Fires when the user clicks into a contentEditable field on the block (single-click toolbar). */
    onInlineFocus?: (payload: InlineFieldFocusPayload) => void;
    children: ReactNode;
}

/**
 * Click-to-select wrapper for blocks rendered on the canvas. Owns:
 *
 * - Selection chrome (2px blue border + 8 corner/edge handles) when selected.
 * - Hover outline (1px dashed blue) when guides are on and the block is not selected.
 * - Click capture that calls setSelectedBlockId(blockId) and stops propagation.
 * - Single-click into contentEditable: routes the field rect + data to onInlineFocus
 *   so the caller can open the inline toolbar on the same gesture.
 * - pointer-events policy:
 *     - 'social_embed' → always pointer-events-auto (iframe interaction)
 *     - 'hero' | 'heading' → pointer-events-auto (contentEditable click capture)
 *     - everything else → pointer-events-none on inner content so clicks land on the
 *       wrapper, not on links/buttons inside the block preview.
 *
 * This component is used both at the page root (CanvasStudio) and inside container
 * renderers (DefaultColumnsBlock, DefaultGridBlock), so nested blocks become
 * directly selectable on canvas with consistent chrome.
 */
export function SelectableBlock({
    blockId,
    blockType,
    blockData,
    onInlineFocus,
    children,
}: SelectableBlockProps) {
    // Context-safe: returns plain children when no EditorProvider is mounted (public site).
    // This lets container renderers wrap their nested blocks unconditionally without
    // worrying about the public-site case.
    const editor = useContext(EditorContext);
    if (!editor) {
        return <>{children}</>;
    }
    const { selection, setSelection, showGuides } = editor;
    const isSelected = selection.kind === 'blocks' && selection.ids.includes(blockId);
    const hasChildSelection = selection.kind === 'slots' && selection.containerId === blockId;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelection({ kind: 'blocks', ids: [blockId] });
        // Single-click into a contentEditable field: select block + open toolbar in one gesture.
        const ce = (e.target as HTMLElement).closest<HTMLElement>('[contenteditable="true"][data-field]');
        if (ce && onInlineFocus) {
            const field = ce.dataset.field!;
            onInlineFocus({
                blockId,
                field,
                rect: ce.getBoundingClientRect(),
                currentData: blockData,
            });
            ce.focus();
        }
    };

    // pointer-events policy: contentEditable / iframe blocks need pointer-events-auto.
    // Container blocks (columns, grid) MUST allow pointer-events-auto so their nested
    // SelectableBlock wrappers can receive clicks — otherwise a pointer-events-none
    // ancestor disables interaction with every descendant, even SelectableBlocks
    // inside (CSS `pointer-events: auto` re-enables interaction only when the
    // descendant explicitly sets it, but our nested wrappers have default which
    // inherits `none` from the parent content layer).
    const allowsPointerEvents =
        blockType === 'social_embed' ||
        blockType === 'hero' ||
        blockType === 'heading' ||
        blockType === 'columns' ||
        blockType === 'grid' ||
        blockType === 'feature_cards';

    return (
        <div
            data-block-id={blockId}
            className={`min-w-0 relative ${isSelected ? 'z-20' : 'cursor-pointer'}`}
            onClick={handleClick}
        >
            <SelectionChrome selected={isSelected} hoverGuide={showGuides && !isSelected && !hasChildSelection} />

            <div className={allowsPointerEvents ? 'pointer-events-auto' : 'pointer-events-none'}>
                {children}
            </div>
        </div>
    );
}

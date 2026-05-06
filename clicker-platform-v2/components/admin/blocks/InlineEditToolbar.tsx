'use client';

import { Fragment, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlignLeft, AlignCenter, AlignRight, Trash2, Type } from 'lucide-react';

export interface InlineFieldFocus {
    blockId: string;
    field: string;         // 'tagline' | 'title' | 'subtitle'
    rect: DOMRect;
    currentData: Record<string, any>;
}

interface Props {
    focus: InlineFieldFocus | null;
    onAction: (blockId: string, patch: Record<string, any>) => void;
    onDismiss?: () => void;
}

const TITLE_SIZES = ['sm', 'md', 'lg', 'xl'] as const;

// Guard: clicking toolbar buttons fires mousedown before blur — we suppress blur commit
// by keeping a ref that EditableText can also read. We export it so EditableText can check it.
export const toolbarMouseDownRef = { current: false };

export function InlineEditToolbar({ focus, onAction, onDismiss }: Props) {
    const [mounted, setMounted] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const toolbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    // Recompute position whenever focus rect changes
    useEffect(() => {
        if (!focus) return;
        const r = focus.rect;
        const TOOLBAR_H = 44;
        const MARGIN = 6;
        const top = r.top + window.scrollY - TOOLBAR_H - MARGIN;
        const left = r.left + window.scrollX + r.width / 2;
        setPos({ top, left });
    }, [focus]);

    // Dismiss whenever the click target is not inside the toolbar AND not on a contentEditable
    useEffect(() => {
        if (!focus || !onDismiss) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            // Click inside toolbar — keep open
            if (toolbarRef.current?.contains(target)) return;
            // Click on a contentEditable text element — keep open (focus will switch to it)
            if (target.closest('[contenteditable="true"]')) return;
            onDismiss();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [focus, onDismiss]);

    if (!mounted || !focus) return null;

    const { blockId, field, currentData } = focus;
    const isTitle = field === 'title' || field === 'heading';
    const titleSize = field === 'heading'
        ? (currentData.headingSize || 'xl')
        : (currentData.titleSize || 'md');
    const alignKey =
        field === 'tagline' ? 'taglineAlign' :
        field === 'title' ? 'titleAlign' :
        field === 'heading' ? 'headingAlign' :
        field === 'subheading' ? 'subheadingAlign' :
        'subtitleAlign';
    const fallbackAlign = currentData.textAlign || 'left';
    const textAlign = currentData[alignKey] ?? fallbackAlign;

    const btn = (onClick: () => void, children: React.ReactNode, active = false, danger = false) => (
        <button
            type="button"
            onMouseDown={(e) => {
                // Prevent the blur on the contentEditable from firing before the click
                e.preventDefault();
                toolbarMouseDownRef.current = true;
                setTimeout(() => { toolbarMouseDownRef.current = false; }, 200);
            }}
            onClick={onClick}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors text-sm font-bold
                ${danger
                    ? 'text-red-400 hover:bg-red-500/10'
                    : active
                    ? 'bg-blue-500/15 text-blue-500'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
        >
            {children}
        </button>
    );

    const divider = <div className="w-px h-5 bg-neutral-200 mx-0.5 flex-shrink-0" />;

    const toolbar = (
        <div
            ref={toolbarRef}
            className="fixed z-[200] -translate-x-1/2 pointer-events-auto"
            style={{ top: pos.top, left: pos.left }}
        >
            <div className="flex items-center gap-0.5 bg-white border border-neutral-200 rounded-xl shadow-xl px-1.5 py-1">
                {/* Title size — title field only */}
                {isTitle && (
                    <>
                        {TITLE_SIZES.map(size => (
                            <Fragment key={size}>
                                {btn(
                                    () => onAction(blockId, field === 'heading' ? { headingSize: size } : { titleSize: size }),
                                    <span className="text-[11px] font-extrabold">{size.toUpperCase()}</span>,
                                    titleSize === size
                                )}
                            </Fragment>
                        ))}
                        {divider}
                    </>
                )}

                {/* Field label */}
                <div className="flex items-center gap-1 px-1.5 text-[11px] font-semibold text-neutral-400 select-none">
                    <Type size={11} />
                    <span className="capitalize">{field}</span>
                </div>

                {divider}

                {/* Text alignment */}
                {btn(() => onAction(blockId, { [alignKey]: 'left' }),   <AlignLeft   size={14} />, textAlign === 'left')}
                {btn(() => onAction(blockId, { [alignKey]: 'center' }), <AlignCenter size={14} />, textAlign === 'center')}
                {btn(() => onAction(blockId, { [alignKey]: 'right' }),  <AlignRight  size={14} />, textAlign === 'right')}

                {divider}

                {/* Clear field */}
                {btn(() => onAction(blockId, { [field]: '' }), <Trash2 size={13} />, false, true)}
            </div>

            {/* Downward caret */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full w-0 h-0
                border-x-4 border-x-transparent border-t-4 border-t-neutral-200" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[1px] translate-y-full w-0 h-0
                border-x-[3.5px] border-x-transparent border-t-[3.5px] border-t-white" />
        </div>
    );

    return createPortal(toolbar, document.body);
}

// clicker-platform-v2/components/admin/blocks/rich-text/popovers/FontSizePopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import { Popover } from './Popover';
import { SIZE_TOKENS, isSizeToken } from '../tokens';
import { useEditorState } from '../hooks/useEditorState';

export function FontSizePopover({ editor }: { editor: Editor | null }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    // Disabled when selection touches any non-paragraph block.
    const disabled = useEditorState(editor, (ed) => {
        if (!ed) return true;
        const { from, to } = ed.state.selection;
        let bad = false;
        ed.state.doc.nodesBetween(from, to, (node) => {
            if (node.isBlock && node.type.name !== 'paragraph') { bad = true; return false; }
        });
        return bad;
    });

    const current = useEditorState(editor, (ed) => {
        if (!ed) return null;
        const attrs = ed.getAttributes('paragraph');
        return isSizeToken(attrs.fontSize) ? attrs.fontSize : null;
    });

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                disabled={disabled}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                title={disabled ? 'Font size applies to paragraphs only' : 'Font size'}
                className="h-10 md:h-[30px] px-3 md:px-2 rounded-md text-xs font-medium hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <span>Aa {current ? current.toUpperCase() : 'M'}</span>
                <ChevronDown size={10} className="text-neutral-400" />
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <div className="p-2 min-w-[140px]">
                    {SIZE_TOKENS.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                                editor?.chain().focus().setFontSize(t.id).run();
                                setOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                        >
                            <span style={{ fontSize: t.px }}>Body {t.label}</span>
                            <span className="text-[10px] font-mono text-neutral-400">{t.px}px</span>
                        </button>
                    ))}
                </div>
            </Popover>
        </>
    );
}

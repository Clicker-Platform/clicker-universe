// clicker-platform-v2/components/admin/blocks/rich-text/popovers/LineHeightPopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import { Popover } from './Popover';
import { LINE_HEIGHT_TOKENS, isLineHeightToken } from '../tokens';
import { useEditorState } from '../hooks/useEditorState';

export function LineHeightPopover({ editor }: { editor: Editor | null }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const current = useEditorState(editor, (ed) => {
        if (!ed) return 'normal';
        for (const type of ['paragraph', 'heading', 'listItem']) {
            const v = ed.getAttributes(type).lineHeight;
            if (isLineHeightToken(v)) return v;
        }
        return 'normal';
    });

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                title="Line height"
                className="h-[30px] px-2 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1"
            >
                <span>↕ {current.charAt(0).toUpperCase() + current.slice(1)}</span>
                <ChevronDown size={10} className="text-neutral-400" />
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <div className="p-2 min-w-[180px]">
                    {LINE_HEIGHT_TOKENS.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                                editor?.chain().focus().setLineHeight(t.id).run();
                                setOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                        >
                            <span>{t.label}</span>
                            <span className="text-[10px] font-mono text-neutral-400">×{t.multiplier.toFixed(2)}</span>
                        </button>
                    ))}
                </div>
            </Popover>
        </>
    );
}

// clicker-platform-v2/components/admin/blocks/rich-text/popovers/HighlightPopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Popover } from './Popover';
import { ColorPickerBody } from './ColorPickerBody';
import { useRecentColors } from '../hooks/useRecentColors';
import { HIGHLIGHT_TOKENS, isHighlightToken } from '../tokens';

export function HighlightPopover({ editor }: { editor: Editor | null }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);
    const { recent, push } = useRecentColors();

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                title="Highlight"
                className="h-[30px] w-[30px] rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center"
            >
                <span className="px-1 rounded-sm bg-yellow-200 text-neutral-900 font-bold text-xs">A</span>
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <ColorPickerBody
                    tokens={HIGHLIGHT_TOKENS}
                    recent={recent}
                    onPickToken={(id) => {
                        if (!editor || !isHighlightToken(id)) return;
                        editor.chain().focus().setTokenHighlight(id).run();
                        setOpen(false);
                    }}
                    onPickHex={(hex) => {
                        if (!editor) return;
                        editor.chain().focus().setCustomHighlight(hex).run();
                        push(hex);
                        setOpen(false);
                    }}
                    onClear={() => {
                        if (!editor) return;
                        editor.chain().focus().unsetTokenHighlight().run();
                        setOpen(false);
                    }}
                />
            </Popover>
        </>
    );
}

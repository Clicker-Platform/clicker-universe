// clicker-platform-v2/components/admin/blocks/rich-text/popovers/ColorPopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Popover } from './Popover';
import { ColorPickerBody } from './ColorPickerBody';
import { useRecentColors } from '../hooks/useRecentColors';
import { COLOR_TOKENS, isColorToken } from '../tokens';

export function ColorPopover({ editor }: { editor: Editor | null }) {
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
                title="Text color"
                className="h-10 w-10 md:h-[30px] md:w-[30px] rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center text-neutral-700 dark:text-neutral-300 font-semibold"
            >
                A
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <ColorPickerBody
                    tokens={COLOR_TOKENS}
                    recent={recent}
                    onPickToken={(id) => {
                        if (!editor || !isColorToken(id)) return;
                        editor.chain().focus().setTokenColor(id).run();
                        setOpen(false);
                    }}
                    onPickHex={(hex) => {
                        if (!editor) return;
                        editor.chain().focus().setCustomColor(hex).run();
                        push(hex);
                        setOpen(false);
                    }}
                    onClear={() => {
                        if (!editor) return;
                        editor.chain().focus().unsetTokenColor().run();
                        setOpen(false);
                    }}
                />
            </Popover>
        </>
    );
}

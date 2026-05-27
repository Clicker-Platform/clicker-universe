// clicker-platform-v2/components/admin/blocks/rich-text/popovers/HeadingPopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import { Popover } from './Popover';
import { useEditorState } from '../hooks/useEditorState';

interface Props { editor: Editor | null; }

const OPTIONS = [
    { kind: 'heading', level: 1 as const, label: 'Heading 1', sample: 'text-2xl font-bold' },
    { kind: 'heading', level: 2 as const, label: 'Heading 2', sample: 'text-xl font-semibold' },
    { kind: 'heading', level: 3 as const, label: 'Heading 3', sample: 'text-lg font-semibold' },
    { kind: 'heading', level: 4 as const, label: 'Heading 4', sample: 'text-base font-semibold' },
    { kind: 'paragraph' as const, label: 'Paragraph', sample: 'text-sm' },
    { kind: 'codeBlock' as const, label: 'Code block', sample: 'text-sm font-mono' },
];

export function HeadingPopover({ editor }: Props) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const currentLabel = useEditorState(editor, (ed) => {
        if (!ed) return 'Paragraph';
        if (ed.isActive('heading', { level: 1 })) return 'H1';
        if (ed.isActive('heading', { level: 2 })) return 'H2';
        if (ed.isActive('heading', { level: 3 })) return 'H3';
        if (ed.isActive('heading', { level: 4 })) return 'H4';
        if (ed.isActive('codeBlock')) return 'Code';
        return 'Paragraph';
    });

    const apply = (opt: typeof OPTIONS[number]) => {
        if (!editor) return;
        if (opt.kind === 'heading') editor.chain().focus().toggleHeading({ level: opt.level }).run();
        else if (opt.kind === 'codeBlock') editor.chain().focus().toggleCodeBlock().run();
        else editor.chain().focus().setParagraph().run();
        setOpen(false);
    };

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                className="h-[30px] px-2 rounded-md text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1"
                title="Block type"
            >
                <span>{currentLabel}</span>
                <ChevronDown size={12} className="text-neutral-400" />
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <div className="p-2 min-w-[180px]">
                    {OPTIONS.map(opt => (
                        <button
                            key={opt.kind === 'heading' ? `h${opt.level}` : opt.kind}
                            type="button"
                            onClick={() => apply(opt)}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                        >
                            <span className={opt.sample}>{opt.label}</span>
                        </button>
                    ))}
                </div>
            </Popover>
        </>
    );
}

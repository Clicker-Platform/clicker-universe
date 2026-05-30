'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { VideoEmbed } from './VideoEmbedExtension';
import { Toolbar } from './Toolbar';
import { TokenColor } from './extensions/TokenColor';
import { TokenHighlight } from './extensions/TokenHighlight';
import { FontSize } from './extensions/FontSize';
import { LineHeight } from './extensions/LineHeight';

export type RichTextPreset = 'basic'; // 'full' is reserved for the future blog editor

interface RichTextEditorProps {
    value?: string;
    onChange: (html: string) => void;
    placeholder?: string;
    preset?: RichTextPreset;
}

// Adds the few keyboard shortcuts spec §8 prescribes that StarterKit does NOT
// already bind. Heading levels (Mod-Alt-1..4) are bound by the Heading extension
// inside StarterKit, so they are NOT re-bound here.
const RteShortcuts = Extension.create({
    name: 'rteShortcuts',
    addKeyboardShortcuts() {
        return {
            'Mod-Alt-0': () => this.editor.chain().focus().setParagraph().run(),
            'Mod-Shift-h': () => this.editor.chain().focus().setTokenHighlight('yellow').run(),
            'Mod-Shift-l': () => this.editor.chain().focus().setTextAlign('left').run(),
            'Mod-Shift-e': () => this.editor.chain().focus().setTextAlign('center').run(),
            'Mod-Shift-r': () => this.editor.chain().focus().setTextAlign('right').run(),
        };
    },
});

export const RichTextEditor = ({ value, onChange, placeholder = 'Write something amazing...', preset = 'basic' }: RichTextEditorProps) => {
    // The `preset` prop is accepted but only 'basic' is implemented today.
    // Future C preset will branch the extension list here.
    void preset;

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
            }),
            Image.configure({
                allowBase64: true,
                inline: true,
                HTMLAttributes: { class: 'max-w-full h-auto my-4' },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400 font-medium cursor-pointer transition-all',
                },
            }),
            Placeholder.configure({ placeholder }),
            TextStyle,
            TokenColor,
            TokenHighlight,
            FontSize,
            LineHeight,
            TextAlign.configure({ types: ['paragraph', 'heading'] }),
            RteShortcuts,
            VideoEmbed as any,
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[150px] px-4 py-4 prose-headings:font-heading dark:prose-headings:text-neutral-100 prose-p:text-neutral-700 dark:prose-p:text-neutral-200 prose-p:font-body prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100 prose-ul:text-neutral-700 dark:prose-ul:text-neutral-300 prose-ol:text-neutral-700 dark:prose-ol:text-neutral-300 prose-blockquote:text-neutral-600 dark:prose-blockquote:text-neutral-300 prose-blockquote:border-l-blue-500 prose-a:text-blue-400 prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-li:leading-snug [&_li>p]:my-0',
            },
        },
        immediatelyRender: false,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    return (
        <div
            className="bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-lg"
            style={{
                ['--theme-foreground' as any]: '#e5e5e5',
                ['--theme-primary' as any]: '#60a5fa',
                ['--theme-radius' as any]: '1rem',
                ['--font-heading' as any]: 'inherit',
                ['--font-body' as any]: 'inherit',
            }}
        >
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
};

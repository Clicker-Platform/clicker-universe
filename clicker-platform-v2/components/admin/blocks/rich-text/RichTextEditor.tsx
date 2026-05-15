'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { VideoEmbed } from './VideoEmbedExtension';
import { Toolbar } from './Toolbar';

interface RichTextEditorProps {
    value?: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

export const RichTextEditor = ({ value, onChange, placeholder = 'Write something amazing...' }: RichTextEditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Image.configure({
                allowBase64: true,
                inline: true,
                HTMLAttributes: {
                    class: 'max-w-full h-auto my-4',
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400 font-medium cursor-pointer transition-all',
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
            VideoEmbed as unknown as NonNullable<Parameters<typeof useEditor>[0]>['extensions'] extends (infer E)[] ? E : never,
        ],
        content: value,
        editorProps: {
            attributes: {
                // Tailwind Typography Configuration
                // usage of CSS variables for theme compatibility
                class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[150px] px-4 py-4 prose-headings:font-heading dark:prose-headings:text-neutral-100 prose-p:text-neutral-700 dark:prose-p:text-neutral-200 prose-p:font-body prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100 prose-ul:text-neutral-700 dark:prose-ul:text-neutral-300 prose-ol:text-neutral-700 dark:prose-ol:text-neutral-300 prose-blockquote:text-neutral-600 dark:prose-blockquote:text-neutral-300 prose-blockquote:border-l-blue-500 prose-a:text-blue-400'
            }
        },
        immediatelyRender: false, // Fix for SSR hydration mismatch
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    return (
        <div
            className="bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-lg"
            style={{
                // Fallback variables for Admin Context where TemplateProvider is missing
                '--theme-foreground': '#e5e5e5', // neutral-200
                '--theme-primary': '#60a5fa',    // blue-400
                '--theme-radius': '1rem',
                '--font-heading': 'inherit',
                '--font-body': 'inherit',
            } as React.CSSProperties}
        >
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
};

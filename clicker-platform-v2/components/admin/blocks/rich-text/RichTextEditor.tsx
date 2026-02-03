'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Toolbar } from './Toolbar';
import { useEffect } from 'react';

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
                    class: 'text-brand-dark underline decoration-brand-dark/30 hover:decoration-brand-dark font-medium cursor-pointer',
                },
            }),
            Placeholder.configure({
                placeholder,
            })
        ],
        content: value,
        editorProps: {
            attributes: {
                // Tailwind Typography Configuration
                // usage of CSS variables for theme compatibility
                class: 'prose prose-lg max-w-none focus:outline-none min-h-[150px] px-4 py-4 prose-headings:font-heading prose-headings:text-[var(--theme-foreground)] prose-p:text-[var(--theme-foreground)] prose-p:font-body prose-strong:text-[var(--theme-foreground)] prose-ul:text-[var(--theme-foreground)] prose-ol:text-[var(--theme-foreground)] prose-quote:text-[var(--theme-foreground)] prose-quote:border-l-[var(--theme-primary)] prose-a:text-[var(--theme-primary)]'
            }
        },
        immediatelyRender: false, // Fix for SSR hydration mismatch
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Sync external value changes if needed (beware of loops)
    // We only update if the content is drastically different to avoid cursor jumping
    // or if the editor is empty (initial load)
    useEffect(() => {
        if (editor && value && editor.getHTML() !== value) {
            // Basic check to prevent loop. Ideally, we shouldn't simple setContent on every keystroke
            // Only set content if the editor is "empty" essentially, or rely on init content.
            // For now, let's rely on init content logic since this is a block editor
            // and blocks don't usually receive external updates while editing.
        }
    }, [value, editor]);

    return (
        <div
            className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden focus-within:border-brand-dark transition-colors shadow-sm"
            style={{
                // Fallback variables for Admin Context where TemplateProvider is missing
                ['--theme-foreground' as any]: '#111827', // gray-900
                ['--theme-primary' as any]: '#0E3B2E',    // brand-dark
                ['--theme-radius' as any]: '0.5rem',
                ['--font-heading' as any]: 'inherit',
                ['--font-body' as any]: 'inherit',
            }}
        >
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
};

'use client';

import type { Editor } from '@tiptap/core';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Quote,
    Link2, Image as ImageIcon, Film,
    Undo, Redo,
    AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import { useState } from 'react';
import { LinkSelector } from './LinkSelector';
import { VideoSelector } from './VideoSelector';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { HeadingPopover } from './popovers/HeadingPopover';
import { ColorPopover } from './popovers/ColorPopover';
import { HighlightPopover } from './popovers/HighlightPopover';
import { FontSizePopover } from './popovers/FontSizePopover';
import { LineHeightPopover } from './popovers/LineHeightPopover';
import { useEditorState } from './hooks/useEditorState';

interface ToolbarProps { editor: Editor | null; }

export const Toolbar = ({ editor }: ToolbarProps) => {
    const [linkSelectorOpen, setLinkSelectorOpen] = useState(false);
    const [videoSelectorOpen, setVideoSelectorOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    const boldActive   = useEditorState(editor, e => !!e?.isActive('bold'));
    const italicActive = useEditorState(editor, e => !!e?.isActive('italic'));
    const ulineActive  = useEditorState(editor, e => !!e?.isActive('underline'));
    const strikeActive = useEditorState(editor, e => !!e?.isActive('strike'));
    const bulletActive = useEditorState(editor, e => !!e?.isActive('bulletList'));
    const orderedActive = useEditorState(editor, e => !!e?.isActive('orderedList'));
    const quoteActive  = useEditorState(editor, e => !!e?.isActive('blockquote'));
    const alignLeft    = useEditorState(editor, e => !!e?.isActive({ textAlign: 'left' }));
    const alignCenter  = useEditorState(editor, e => !!e?.isActive({ textAlign: 'center' }));
    const alignRight   = useEditorState(editor, e => !!e?.isActive({ textAlign: 'right' }));

    if (!editor) return null;

    const Btn = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
        <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={onClick}
            title={title}
            className={`h-10 w-10 md:h-[30px] md:w-[30px] rounded-md inline-flex items-center justify-center transition-colors
                ${active
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-700 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
        >
            {children}
        </button>
    );
    const Sep = () => <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-1" />;

    return (
        <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 items-center">
            <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo size={14} /></Btn>
            <Sep />
            <HeadingPopover editor={editor} />
            <Sep />
            <Btn active={boldActive}   onClick={() => editor.chain().focus().toggleBold().run()}      title="Bold"><Bold size={14} /></Btn>
            <Btn active={italicActive} onClick={() => editor.chain().focus().toggleItalic().run()}    title="Italic"><Italic size={14} /></Btn>
            <Btn active={ulineActive}  onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon size={14} /></Btn>
            <Btn active={strikeActive} onClick={() => editor.chain().focus().toggleStrike().run()}    title="Strikethrough"><Strikethrough size={14} /></Btn>
            <Sep />
            <ColorPopover editor={editor} />
            <HighlightPopover editor={editor} />
            <Sep />
            <FontSizePopover editor={editor} />
            <LineHeightPopover editor={editor} />
            <Sep />
            <Btn active={alignLeft}   onClick={() => editor.chain().focus().setTextAlign('left').run()}   title="Align left"><AlignLeft size={14} /></Btn>
            <Btn active={alignCenter} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center"><AlignCenter size={14} /></Btn>
            <Btn active={alignRight}  onClick={() => editor.chain().focus().setTextAlign('right').run()}  title="Align right"><AlignRight size={14} /></Btn>
            <Sep />
            <Btn active={bulletActive}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet list"><List size={14} /></Btn>
            <Btn active={orderedActive} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered size={14} /></Btn>
            <Btn active={quoteActive}   onClick={() => editor.chain().focus().toggleBlockquote().run()}  title="Blockquote"><Quote size={14} /></Btn>
            <Sep />
            <Btn onClick={() => setLinkSelectorOpen(v => !v)}  title="Link"><Link2 size={14} /></Btn>
            <Btn onClick={() => setPickerOpen(true)}           title="Image"><ImageIcon size={14} /></Btn>
            <Btn onClick={() => setVideoSelectorOpen(v => !v)} title="Video"><Film size={14} /></Btn>

            <LinkSelector editor={editor} isOpen={linkSelectorOpen} onClose={() => setLinkSelectorOpen(false)} />
            <VideoSelector editor={editor} isOpen={videoSelectorOpen} onClose={() => setVideoSelectorOpen(false)} />
            <MediaPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={({ url }) => { editor.chain().focus().setImage({ src: url }).run(); setPickerOpen(false); }}
                accept="image"
            />
        </div>
    );
};

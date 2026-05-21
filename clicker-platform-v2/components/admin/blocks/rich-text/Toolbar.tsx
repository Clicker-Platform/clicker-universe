'use client';

import { Editor } from '@tiptap/react';
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Link2,
    Image as ImageIcon,
    Film,
    Undo,
    Redo,
} from 'lucide-react';
import { useState } from 'react';
import { LinkSelector } from './LinkSelector';
import { VideoSelector } from './VideoSelector';
import { MediaPicker } from '@/components/admin/media/MediaPicker';

interface ToolbarProps {
    editor: Editor | null;
}

export const Toolbar = ({ editor }: ToolbarProps) => {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [linkSelectorOpen, setLinkSelectorOpen] = useState(false);
    const [videoSelectorOpen, setVideoSelectorOpen] = useState(false);

    if (!editor) return null;

    const ToggleButton = ({
        isActive,
        onClick,
        children,
        title
    }: {
        isActive?: boolean;
        onClick: () => void;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            type="button"
            onMouseDown={(e) => {
                e.preventDefault(); // Prevent focus loss
                onClick();
            }}
            title={title}
            className={`
                p-2 rounded-lg transition-all active:scale-95
                ${isActive
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'text-neutral-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                }
            `}
        >
            {children}
        </button>
    );

    return (
        <div className="relative border-b border-gray-200 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/80 backdrop-blur-md p-2 flex flex-wrap gap-1 items-center sticky top-0 z-10">
            {/* History */}
            <div className="flex gap-1 mr-2 border-r border-gray-200 dark:border-neutral-800 pr-2">
                <ToggleButton
                    onClick={() => editor.chain().focus().undo().run()}
                    title="Undo"
                >
                    <Undo size={16} />
                </ToggleButton>
                <ToggleButton
                    onClick={() => editor.chain().focus().redo().run()}
                    title="Redo"
                >
                    <Redo size={16} />
                </ToggleButton>
            </div>

            {/* Typography */}
            <div className="flex gap-1 mr-2 border-r border-gray-200 dark:border-neutral-800 pr-2">
                <ToggleButton
                    isActive={editor.isActive('heading', { level: 2 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    title="Heading 2"
                >
                    <Heading2 size={16} />
                </ToggleButton>
                <ToggleButton
                    isActive={editor.isActive('heading', { level: 3 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    title="Heading 3"
                >
                    <Heading3 size={16} />
                </ToggleButton>
                <ToggleButton
                    isActive={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Bold"
                >
                    <Bold size={16} />
                </ToggleButton>
                <ToggleButton
                    isActive={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italic"
                >
                    <Italic size={16} />
                </ToggleButton>
                <ToggleButton
                    isActive={editor.isActive('strike')}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    title="Strikethrough"
                >
                    <Strikethrough size={16} />
                </ToggleButton>
                <ToggleButton
                    isActive={editor.isActive('codeBlock')}
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    title="Code Block"
                >
                    <Code size={16} />
                </ToggleButton>
            </div>

            {/* Formatting */}
            <div className="flex gap-1 mr-2 border-r border-gray-200 dark:border-neutral-800 pr-2">
                <ToggleButton
                    isActive={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Bullet List"
                >
                    <List size={16} />
                </ToggleButton>
                <ToggleButton
                    isActive={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Numbered List"
                >
                    <ListOrdered size={16} />
                </ToggleButton>
                <ToggleButton
                    isActive={editor.isActive('blockquote')}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    title="Quote"
                >
                    <Quote size={16} />
                </ToggleButton>
            </div>

            {/* Links & Media */}
            <div className="flex gap-1">
                <ToggleButton
                    isActive={editor.isActive('link') || linkSelectorOpen}
                    onClick={() => { setLinkSelectorOpen(!linkSelectorOpen); setVideoSelectorOpen(false); }}
                    title="Link"
                >
                    <Link2 size={16} />
                </ToggleButton>

                <button
                    type="button"
                    onClick={() => { setPickerOpen(true); setLinkSelectorOpen(false); setVideoSelectorOpen(false); }}
                    title="Insert Image"
                    className="p-2 rounded-lg transition-all active:scale-95 text-neutral-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                >
                    <ImageIcon size={16} />
                </button>

                <ToggleButton
                    isActive={videoSelectorOpen}
                    onClick={() => { setVideoSelectorOpen(!videoSelectorOpen); setLinkSelectorOpen(false); }}
                    title="Embed Video"
                >
                    <Film size={16} />
                </ToggleButton>
            </div>

            <LinkSelector
                editor={editor}
                isOpen={linkSelectorOpen}
                onClose={() => setLinkSelectorOpen(false)}
            />
            <VideoSelector
                editor={editor}
                isOpen={videoSelectorOpen}
                onClose={() => setVideoSelectorOpen(false)}
            />
            <MediaPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={({ url }) => {
                    editor.chain().focus().setImage({ src: url }).run();
                    setPickerOpen(false);
                }}
                accept="image"
            />
        </div>
    );
};

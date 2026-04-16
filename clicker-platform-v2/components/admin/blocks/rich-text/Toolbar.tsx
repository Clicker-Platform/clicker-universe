'use client';

import { Editor } from '@tiptap/react';
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Link2,
    Image as ImageIcon,
    Undo,
    Redo,
    Loader2
} from 'lucide-react';
import { useState, useRef } from 'react';
import { convertToWebP, validateImageFile } from '@/lib/imageUtils';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LinkSelector } from './LinkSelector';
import { useSite } from '@/lib/site-context';

interface ToolbarProps {
    editor: Editor | null;
}

export const Toolbar = ({ editor }: ToolbarProps) => {
    const { siteId } = useSite();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [linkSelectorOpen, setLinkSelectorOpen] = useState(false);

    if (!editor) return null;

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateImageFile(file);
        if (validationError) {
            alert(validationError);
            return;
        }

        setUploading(true);
        try {
            // Client-side WebP Conversion (reusing existing utility)
            const webpBlob = await convertToWebP(file);
            const webpFile = new File([webpBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });

            // Upload directly via Client SDK
            // Site-scoped path: sites/{siteId}/uploads/content/{timestamp}_{filename}
            const storagePath = siteId
                ? `sites/${siteId}/uploads/content/${Date.now()}_${file.name}`
                : `uploads/content/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const snapshot = await uploadBytes(storageRef, webpFile, {
                contentType: 'image/webp'
            });
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Insert into Editor
            editor.chain().focus().setImage({ src: downloadURL }).run();

        } catch (error) {
            console.error(error);
            alert("Failed to upload image");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

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
        <div className="border-b border-gray-200 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/80 backdrop-blur-md p-2 flex flex-wrap gap-1 items-center sticky top-0 z-10">
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
            <div className="flex gap-1 relative">
                <ToggleButton
                    isActive={editor.isActive('link')}
                    onClick={() => setLinkSelectorOpen(!linkSelectorOpen)}
                    title="Link"
                >
                    <Link2 size={16} />
                </ToggleButton>

                <LinkSelector
                    editor={editor}
                    isOpen={linkSelectorOpen}
                    onClose={() => setLinkSelectorOpen(false)}
                />

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Upload Image"
                    className={`
                        p-2 rounded-lg transition-all active:scale-95 text-neutral-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200 disabled:opacity-50
                    `}
                >
                    {uploading ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <ImageIcon size={16} />}
                </button>
            </div>
        </div>
    );
};

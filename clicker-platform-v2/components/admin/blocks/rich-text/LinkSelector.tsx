'use client';

import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { Link2, Check, X, Trash2 } from 'lucide-react';

interface LinkSelectorProps {
    editor: Editor;
    isOpen: boolean;
    onClose: () => void;
}

export const LinkSelector = ({ editor, isOpen, onClose }: LinkSelectorProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [url, setUrl] = useState('');

    useEffect(() => {
        if (isOpen) {
            const previousUrl = editor.getAttributes('link').href;
            setUrl(previousUrl || '');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, editor]);

    const setLink = () => {
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
        onClose();
    };

    const removeLink = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="absolute top-12 left-0 z-50 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-gray-200 dark:border-neutral-800 p-2 flex items-center gap-2 min-w-[320px] animate-in fade-in slide-in-from-top-2 duration-300 backdrop-blur-xl">
            <Link2 size={16} className="text-neutral-400 dark:text-neutral-500 ml-1" />
            <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-sm text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 px-1"
                placeholder="Paste URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') setLink();
                    if (e.key === 'Escape') onClose();
                }}
            />
            {editor.isActive('link') && (
                <button
                    type="button"
                    onClick={removeLink}
                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Remove Link"
                >
                    <Trash2 size={14} />
                </button>
            )}
            <div className="w-px h-6 bg-gray-200 dark:bg-neutral-800 mx-1" />
            <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
            >
                <X size={16} />
            </button>
            <button
                type="button"
                onClick={setLink}
                className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all font-bold"
            >
                <Check size={16} />
            </button>
        </div>
    );
};

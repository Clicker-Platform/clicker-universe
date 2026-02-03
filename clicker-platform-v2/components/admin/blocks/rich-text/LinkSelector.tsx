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
        <div className="absolute top-12 left-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 flex items-center gap-2 min-w-[300px] animate-in fade-in slide-in-from-top-2 duration-200">
            <Link2 size={16} className="text-gray-400" />
            <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-gray-400"
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
                    onClick={removeLink}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                    title="Remove Link"
                >
                    <Trash2 size={14} />
                </button>
            )}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
                <X size={14} />
            </button>
            <button
                onClick={setLink}
                className="p-1 text-brand-dark hover:bg-brand-green/10 rounded font-bold"
            >
                <Check size={14} />
            </button>
        </div>
    );
};

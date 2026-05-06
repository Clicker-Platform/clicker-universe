'use client';

import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { Film, Check, X } from 'lucide-react';

interface VideoSelectorProps {
    editor: Editor;
    isOpen: boolean;
    onClose: () => void;
}

export const VideoSelector = ({ editor, isOpen, onClose }: VideoSelectorProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setUrl('');
            setError('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const embed = () => {
        if (!url) return;
        const ok = (editor.chain().focus() as any).setVideoEmbed({ src: url }).run();
        if (!ok) {
            setError('Use a YouTube, Vimeo, or direct .mp4/.webm URL');
            return;
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-neutral-900 rounded-b-lg shadow-2xl border-x border-b border-gray-200 dark:border-neutral-800 p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-300 backdrop-blur-xl">
            <div className="flex items-center gap-2">
                <Film size={16} className="text-neutral-400 dark:text-neutral-500 ml-1 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 bg-transparent border-none outline-none text-sm text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 px-1"
                    placeholder="YouTube, Vimeo, or .mp4 URL..."
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setError(''); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') embed();
                        if (e.key === 'Escape') onClose();
                    }}
                />
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
                    onClick={embed}
                    className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all font-bold"
                >
                    <Check size={16} />
                </button>
            </div>
            {error && (
                <p className="text-[11px] text-red-400 font-medium px-1 pb-1">{error}</p>
            )}
        </div>
    );
};

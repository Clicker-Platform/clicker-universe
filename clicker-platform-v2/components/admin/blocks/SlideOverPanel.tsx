'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface SlideOverPanelProps {
    children: ReactNode;
    title: string;
    icon: React.ElementType;
    onClose: () => void;
}

export function SlideOverPanel({ children, title, icon: Icon, onClose }: SlideOverPanelProps) {
    return (
        <div className="w-[480px] bg-gray-50 dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col flex-shrink-0">
            <div className="px-4 h-10 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2 flex-shrink-0">
                <Icon size={15} className="text-neutral-500 dark:text-neutral-400" />
                <span className="flex-1 font-bold text-sm text-neutral-900 dark:text-neutral-200">{title}</span>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {children}
            </div>
        </div>
    );
}

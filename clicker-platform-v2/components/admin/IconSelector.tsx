'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ICON_MAP, ICON_NAMES } from '@/data/icons';
import { Search, X, ArrowLeft } from 'lucide-react';

interface IconSelectorProps {
    selectedIcon: string;
    onSelect: (iconName: string) => void;
    onClose: () => void;
}

export function IconSelector({ selectedIcon, onSelect, onClose }: IconSelectorProps) {
    const [search, setSearch] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => { Promise.resolve().then(() => setMounted(true)); }, []);

    const filteredIcons = ICON_NAMES.filter(name =>
        name.toLowerCase().includes(search.toLowerCase())
    );

    const modal = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
                    <h3 className="font-bold text-base text-neutral-100">Select Icon</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-neutral-200"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 py-3 border-b border-neutral-800 flex-shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search icons…"
                            className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:border-blue-500/50 focus:outline-none transition-colors"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                        {filteredIcons.map(name => {
                            const Icon = ICON_MAP[name];
                            const isSelected = selectedIcon === name;

                            return (
                                <button
                                    key={name}
                                    onClick={() => onSelect(name)}
                                    className={`
                                        flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all
                                        hover:scale-105 active:scale-95
                                        ${isSelected
                                            ? 'border-blue-500/60 bg-blue-500/15 text-blue-300'
                                            : 'border-neutral-800 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 hover:bg-neutral-800'
                                        }
                                    `}
                                >
                                    <Icon size={20} strokeWidth={isSelected ? 2.5 : 1.75} />
                                    <span className="text-[9px] font-medium truncate w-full text-center text-neutral-500">
                                        {name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {filteredIcons.length === 0 && (
                        <div className="text-center py-10 text-neutral-600 text-sm">
                            No icons found for &ldquo;{search}&rdquo;
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (!mounted) return null;
    return createPortal(modal, document.body);
}

export function InlinePanelIconPicker({
    selectedIcon,
    onSelect,
    onBack,
}: {
    selectedIcon: string;
    onSelect: (iconName: string) => void;
    onBack: () => void;
}) {
    const [search, setSearch] = useState('');
    const filteredIcons = ICON_NAMES.filter(name =>
        name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                >
                    <ArrowLeft size={13} /> Back
                </button>
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 flex-1">Select Icon</span>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={14} />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search icons…"
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-blue-500/50 focus:outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                <div className="grid grid-cols-5 gap-1.5">
                    {filteredIcons.map(name => {
                        const Icon = ICON_MAP[name];
                        const isSelected = selectedIcon === name;
                        return (
                            <button
                                key={name}
                                onClick={() => onSelect(name)}
                                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 ${
                                    isSelected
                                        ? 'border-blue-500/60 bg-blue-500/15 text-blue-600 dark:text-blue-300'
                                        : 'border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 hover:border-gray-400 dark:hover:border-neutral-600 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-gray-200 dark:hover:bg-neutral-800'
                                }`}
                            >
                                <Icon size={18} strokeWidth={isSelected ? 2.5 : 1.75} />
                                <span className="text-[8px] font-medium truncate w-full text-center text-neutral-400 dark:text-neutral-500">
                                    {name}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {filteredIcons.length === 0 && (
                    <div className="text-center py-10 text-neutral-400 dark:text-neutral-600 text-sm">
                        No icons found for &ldquo;{search}&rdquo;
                    </div>
                )}
            </div>
        </div>
    );
}

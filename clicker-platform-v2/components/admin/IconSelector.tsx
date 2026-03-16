'use client';

import { useState } from 'react';
import { ICON_MAP, ICON_NAMES } from '@/data/icons';
import { Search, X } from 'lucide-react';

interface IconSelectorProps {
    selectedIcon: string;
    onSelect: (iconName: string) => void;
    onClose: () => void;
}

export function IconSelector({ selectedIcon, onSelect, onClose }: IconSelectorProps) {
    const [search, setSearch] = useState('');

    const filteredIcons = ICON_NAMES.filter(name =>
        name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                    <h3 className="font-bold text-lg text-brand-dark">Select Icon</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-red-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search icons (e.g. 'instagram', 'shop', 'mail')..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brand-dark outline-none font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <div className="grid grid-cols-4 sm:grid-cols-6 Gap-3">
                        {filteredIcons.map(name => {
                            const Icon = ICON_MAP[name];
                            const isSelected = selectedIcon === name;

                            return (
                                <button
                                    key={name}
                                    onClick={() => onSelect(name)}
                                    className={`
                                        flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all
                                        hover:scale-105 active:scale-95
                                        ${isSelected
                                            ? 'border-gray-400 bg-gray-100 text-brand-dark shadow-md'
                                            : 'border-white bg-white hover:border-brand-green hover:shadow-sm text-gray-600'
                                        }
                                    `}
                                >
                                    <Icon size={24} strokeWidth={isSelected ? 2.5 : 2} />
                                    <span className="text-[10px] font-medium truncate w-full text-center opacity-80">
                                        {name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {filteredIcons.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            <p>No icons found matching "{search}"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

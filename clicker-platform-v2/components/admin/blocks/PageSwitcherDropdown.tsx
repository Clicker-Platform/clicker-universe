'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Home, FileText } from 'lucide-react';
import { usePageStudio } from './PageStudioContext';

export function PageSwitcherDropdown() {
    const { pages, activePageId, formData, globalSettings, switchPage } = usePageStudio();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const homepageSlug = globalSettings?.homepageSlug || 'home';

    // Close dropdown on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const handleSelect = async (pageId: string) => {
        setIsOpen(false);
        await switchPage(pageId);
    };

    const handleCreate = async () => {
        setIsOpen(false);
        await switchPage('create');
    };

    const displaySlug = formData.slug ? `/${formData.slug}` : (activePageId === null ? '/new-page' : '/...');

    return (
        <div ref={dropdownRef} className="relative w-56">
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 hover:bg-neutral-700 transition-colors text-sm font-medium min-w-0"
                >
                    <FileText size={14} className="text-neutral-400 flex-shrink-0" />
                    <span className="truncate">{displaySlug}</span>
                    <ChevronDown size={14} className="text-neutral-400 flex-shrink-0 ml-auto" />
                </button>
                <button
                    type="button"
                    onClick={handleCreate}
                    className="px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors flex-shrink-0"
                    title="New Page"
                >
                    <Plus size={14} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-2xl z-30 max-h-64 overflow-y-auto custom-scrollbar">
                    {pages.length === 0 ? (
                        <div className="p-3 text-center text-neutral-500 text-xs">
                            No pages yet
                        </div>
                    ) : (
                        <div className="p-1">
                            {pages.map(page => (
                                <button
                                    key={page.id}
                                    type="button"
                                    onClick={() => handleSelect(page.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-sm ${
                                        page.id === activePageId
                                            ? 'bg-blue-500/15 text-blue-400'
                                            : 'text-neutral-300 hover:bg-neutral-700'
                                    }`}
                                >
                                    <span className="truncate flex-1 font-medium">{page.title || 'Untitled'}</span>
                                    <span className="text-xs text-neutral-500 flex-shrink-0">/{page.slug}</span>
                                    {page.slug === homepageSlug && (
                                        <Home size={12} className="text-neutral-400 flex-shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

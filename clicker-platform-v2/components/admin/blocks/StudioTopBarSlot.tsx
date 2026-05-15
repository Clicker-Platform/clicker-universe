'use client';

import { useCallback, useEffect, useState } from 'react';
import { Monitor, Tablet, Smartphone, Home, Loader2, Save, FileText, Frame } from 'lucide-react';
import { usePageStudio } from './PageStudioContext';
import { useEditor } from './EditorContext';
import { useTopBarSlots } from '@/lib/top-bar-slot-context';

// Renderless — registers Studio controls into AdminTopBar slots on mount, clears on unmount.
export function StudioTopBarSlot() {
    const {
        activePageId,
        formData,
        globalSettings,
        saving,
        isDirty,
        savePage,
        setHomepage,
        unsetHomepage,
        setTitle,
    } = usePageStudio();

    const { deviceView, setDeviceView, showGuides, setShowGuides } = useEditor();
    const { setLeftSlot, setCenterSlot, setRightSlot, clearSlots } = useTopBarSlots();
    const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

    const homepageSlug = globalSettings?.homepageSlug || 'home';
    const isHomepage = formData.slug === homepageSlug && activePageId !== null;

    const handleHomepageToggle = useCallback(async () => {
        if (isHomepage) {
            await unsetHomepage();
        } else {
            await setHomepage();
        }
    }, [isHomepage, unsetHomepage, setHomepage]);

    // Left slot — editable page name
    useEffect(() => {
        setLeftSlot(
            <div className="flex items-center gap-2 min-w-0">
                <FileText size={13} className="text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled"
                    className="text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 -ml-1 w-32 focus:w-48 sm:w-48 sm:focus:w-64 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600 truncate focus:truncate-none"
                />
                {formData.slug && (
                    <span className="text-xs text-neutral-400 dark:text-neutral-600 truncate hidden sm:block">
                        /{formData.slug}
                    </span>
                )}
            </div>
        );
    }, [formData.title, formData.slug, setTitle, setLeftSlot]);

    // Center slot — device toggles + guides
    useEffect(() => {
        setCenterSlot(
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                    {([
                        { view: 'desktop', icon: Monitor, label: 'Desktop' },
                        { view: 'tablet', icon: Tablet, label: 'Tablet' },
                        { view: 'mobile', icon: Smartphone, label: 'Mobile' },
                    ] as const).map(({ view, icon: Icon, label }) => (
                        <button
                            key={view}
                            type="button"
                            onClick={() => setDeviceView(view)}
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltip({ label, top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className={`p-1.5 rounded-md transition-colors ${
                                deviceView === view
                                    ? 'bg-gray-200 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                            }`}
                        >
                            <Icon size={16} />
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => setShowGuides(!showGuides)}
                    onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ label: showGuides ? 'Hide Guides' : 'Show Guides', top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                        showGuides
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }`}
                >
                    <Frame size={16} />
                </button>
            </div>
        );
    }, [deviceView, showGuides, setDeviceView, setShowGuides, setCenterSlot]);

    // Right slot — homepage toggle + save
    useEffect(() => {
        setRightSlot(
            <>
                {activePageId !== null && (
                    <button
                        type="button"
                        onClick={handleHomepageToggle}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isHomepage
                                ? 'bg-studio-blue-muted/15 text-studio-blue-muted border border-studio-blue-muted/30 hover:bg-studio-blue-muted/25'
                                : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-200 dark:hover:bg-neutral-700'
                        }`}
                    >
                        <Home size={14} />
                        {isHomepage ? 'Unset Home' : 'Set as Home'}
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => savePage()}
                    disabled={saving}
                    className="relative flex items-center gap-2 bg-studio-blue text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-studio-blue/85 transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Save
                    {isDirty && !saving && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-400 rounded-full" />
                    )}
                </button>

                {/* Tooltip rendered here so it has access to the fixed viewport */}
                {tooltip && (
                    <div
                        className="fixed z-[100] bg-gray-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xl animate-in fade-in duration-150 pointer-events-none whitespace-nowrap -translate-x-1/2"
                        style={{ top: tooltip.top, left: tooltip.left }}
                    >
                        {tooltip.label}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
                    </div>
                )}
            </>
        );
    }, [activePageId, isHomepage, saving, isDirty, savePage, tooltip, setRightSlot, handleHomepageToggle]);

    // Clear all slots on unmount (navigating away from Canvas Studio)
    useEffect(() => {
        return () => clearSlots();
    }, [clearSlots]);

    return null;
}

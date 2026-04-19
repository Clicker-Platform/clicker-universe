'use client';

import { Monitor, Tablet, Smartphone, Home, Loader2, Save, FileText, Frame } from 'lucide-react';
import { usePageStudio } from './PageStudioContext';
import { useEditor } from './EditorContext';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

export function StudioTopBar() {
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
    const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);
    const isMobile = useIsMobile();

    const homepageSlug = globalSettings?.homepageSlug || 'home';
    const isHomepage = formData.slug === homepageSlug && activePageId !== null;

    const handleHomepageToggle = async () => {
        if (isHomepage) {
            await unsetHomepage();
        } else {
            await setHomepage();
        }
    };

    return (
        <div className="flex items-center justify-between px-4 h-12 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
            {/* Left — Current page name */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
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

            {/* Center — Device toggle + guides toggle (hidden on mobile) */}
            {!isMobile && (
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

                    {/* Guides toggle */}
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
            )}

            {/* Right — Homepage toggle + Save */}
            <div className="flex-1 flex items-center justify-end gap-2">
                {activePageId !== null && (
                    isMobile ? (
                        /* Icon-only on mobile to save space */
                        <button
                            type="button"
                            onClick={handleHomepageToggle}
                            className={`p-2 rounded-lg transition-colors ${
                                isHomepage
                                    ? 'bg-studio-blue-muted/15 text-studio-blue-muted border border-studio-blue-muted/30'
                                    : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-200'
                            }`}
                            title={isHomepage ? 'Unset as Homepage' : 'Set as Homepage'}
                        >
                            <Home size={16} />
                        </button>
                    ) : (
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
                    )
                )}

                {/* Save — hidden on mobile (handled by tab bar) */}
                {!isMobile && (
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
                )}
            </div>

            {tooltip && (
                <div
                    className="fixed z-[100] bg-gray-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xl animate-in fade-in duration-150 pointer-events-none whitespace-nowrap -translate-x-1/2"
                    style={{ top: tooltip.top, left: tooltip.left }}
                >
                    {tooltip.label}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
                </div>
            )}
        </div>
    );
}

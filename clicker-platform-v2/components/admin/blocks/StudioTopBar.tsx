'use client';

import { Monitor, Tablet, Smartphone, Home, Loader2, Save } from 'lucide-react';
import { usePageStudio } from './PageStudioContext';
import { useEditor } from './EditorContext';
import { PageSwitcherDropdown } from './PageSwitcherDropdown';
import { useState } from 'react';

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
    } = usePageStudio();

    const { deviceView, setDeviceView } = useEditor();
    const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

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
        <div className="flex items-center justify-between px-4 h-12 bg-neutral-900 border-b border-neutral-800 flex-shrink-0">
            {/* Left — Page Switcher */}
            <div className="flex-1 flex items-center">
                <PageSwitcherDropdown />
            </div>

            {/* Center — Device toggle */}
            <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
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
                                ? 'bg-neutral-700 text-white'
                                : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        <Icon size={16} />
                    </button>
                ))}
            </div>

            {/* Right — Homepage toggle + Save */}
            <div className="flex-1 flex items-center justify-end gap-2">
                {activePageId !== null && (
                    <button
                        type="button"
                        onClick={handleHomepageToggle}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isHomepage
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-neutral-200 hover:bg-neutral-700'
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
                    className="relative flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Save
                    {isDirty && !saving && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-400 rounded-full" />
                    )}
                </button>
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

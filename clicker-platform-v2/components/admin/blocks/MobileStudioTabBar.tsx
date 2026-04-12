'use client';

import { Layers, Plus, Settings, Save, Loader2, FileText, MoreHorizontal } from 'lucide-react';

export type MobileActiveSheet = 'navigator' | 'add' | 'props' | 'pages' | 'more' | null;

interface MobileStudioTabBarProps {
    activeSheet: MobileActiveSheet;
    onTabPress: (tab: MobileActiveSheet) => void;
    hasBlockSelected: boolean;
    isDirty: boolean;
    saving: boolean;
    onSave: () => void;
}

const tabs = [
    { id: 'pages' as const, icon: FileText, label: 'Pages' },
    { id: 'navigator' as const, icon: Layers, label: 'Layers' },
    { id: 'add' as const, icon: Plus, label: 'Add' },
    { id: 'props' as const, icon: Settings, label: 'Properties' },
    { id: 'more' as const, icon: MoreHorizontal, label: 'More' },
] as const;

export function MobileStudioTabBar({
    activeSheet,
    onTabPress,
    hasBlockSelected,
    isDirty,
    saving,
    onSave,
}: MobileStudioTabBarProps) {
    return (
        <div className="fixed bottom-0 left-0 right-0 flex items-stretch bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 z-20"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {tabs.map(({ id, icon: Icon, label }) => {
                const isActive = activeSheet === id;
                const showBadge = id === 'props' && hasBlockSelected && !isActive;
                return (
                    <button
                        key={id}
                        onClick={() => onTabPress(isActive ? null : id)}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative ${
                            isActive
                                ? 'text-blue-400 bg-blue-500/10'
                                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                        }`}
                    >
                        <div className="relative">
                            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                            {showBadge && (
                                <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-blue-400 rounded-full" />
                            )}
                        </div>
                        <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                    </button>
                );
            })}

            {/* Divider */}
            <div className="w-px bg-gray-200 dark:bg-neutral-800 self-stretch my-2" />

            {/* Save button */}
            <button
                onClick={onSave}
                disabled={saving}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative ${
                    isDirty && !saving
                        ? 'text-orange-400'
                        : 'text-neutral-400 dark:text-neutral-500'
                } disabled:opacity-50`}
            >
                <div className="relative">
                    {saving
                        ? <Loader2 size={20} className="animate-spin" />
                        : <Save size={20} strokeWidth={1.8} />
                    }
                    {isDirty && !saving && (
                        <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-orange-400 rounded-full" />
                    )}
                </div>
                <span className="text-[10px] font-semibold tracking-wide">Save</span>
            </button>
        </div>
    );
}

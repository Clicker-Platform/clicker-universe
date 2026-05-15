'use client';

import { useState, useEffect } from 'react';
import { Type, Globe } from 'lucide-react';
import { HeaderNavPanel } from './panels/HeaderNavPanel';
import { ChromeBottomNavProperties } from './panels/ChromeBottomNavProperties';

export function ChromeHeaderPanel() {
    return <HeaderNavPanel />;
}

export function ChromeFooterPanel({
    footerText,
    onFooterTextChange
}: {
    footerText: string;
    onFooterTextChange: (val: string) => Promise<void>;
}) {
    const [localValue, setLocalValue] = useState(footerText || '');

    // Sync if the external value changes (e.g. initial load)
    useEffect(() => {
        Promise.resolve().then(() => setLocalValue(footerText || ''));
    }, [footerText]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Global Badge */}
            <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center shadow-lg text-blue-400">
                        <Globe size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-neutral-900 dark:text-neutral-200 text-sm">Site Footer</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="flex w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Global Setting</span>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                The footer appears at the very bottom of every page.
            </p>

            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
                <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                        <Type size={16} className="text-neutral-500 dark:text-neutral-500" />
                        Footer Text
                    </label>
                    <input
                        type="text"
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={() => onFooterTextChange(localValue)}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                        placeholder="e.g., © 2026 My Business. All rights reserved."
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                        Saved when you click away from the field.
                    </p>
                </div>
            </div>
        </div>
    );
}

export function ChromeBottomNavPanel() {
    return <ChromeBottomNavProperties />;
}

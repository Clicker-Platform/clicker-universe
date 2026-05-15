'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { MobileBottomSheet } from '@/components/admin/blocks/MobileBottomSheet';

interface TabItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

interface MobileModuleTabBarProps {
    items: TabItem[];
    activeHref: string | null;
}

const MAX_VISIBLE = 4;

export function MobileModuleTabBar({ items, activeHref }: MobileModuleTabBarProps) {
    const [moreOpen, setMoreOpen] = useState(false);

    const hasOverflow = items.length > MAX_VISIBLE;
    const visibleItems = hasOverflow ? items.slice(0, MAX_VISIBLE) : items;
    const overflowItems = hasOverflow ? items.slice(MAX_VISIBLE) : [];

    // If active item is in overflow, swap it into the last visible slot
    const activeIsOverflow = overflowItems.some(i => i.href === activeHref);
    const displayItems = [...visibleItems];
    let displayOverflow = [...overflowItems];

    if (activeIsOverflow) {
        const activeItem = overflowItems.find(i => i.href === activeHref)!;
        const lastVisible = displayItems[MAX_VISIBLE - 1];
        displayItems[MAX_VISIBLE - 1] = activeItem;
        displayOverflow = [lastVisible, ...overflowItems.filter(i => i.href !== activeHref)];
    }

    return (
        <>
            {/* Overflow sheet using the same MobileBottomSheet as Canvas Studio */}
            <MobileBottomSheet
                isOpen={moreOpen}
                onClose={() => setMoreOpen(false)}
                title="More"
                icon={MoreHorizontal}
                height="auto"
            >
                <div className="p-3 space-y-1">
                    {displayOverflow.map((item) => {
                        const isActive = activeHref === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMoreOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                    isActive
                                        ? 'text-blue-400 bg-blue-500/10'
                                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
                                }`}
                            >
                                <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                                <span className="text-sm font-semibold">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </MobileBottomSheet>

            {/* Bottom tab bar */}
            <div
                className="fixed bottom-0 left-0 right-0 z-20 flex items-stretch bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                {displayItems.map((item) => {
                    const isActive = activeHref === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                                isActive
                                    ? 'text-blue-400 bg-blue-500/10'
                                    : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                            }`}
                        >
                            <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                            <span className="text-[10px] font-semibold tracking-wide truncate max-w-[60px] text-center">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {hasOverflow && (
                    <>
                        {/* Divider */}
                        <div className="w-px bg-gray-200 dark:bg-neutral-800 self-stretch my-2" />
                        <button
                            onClick={() => setMoreOpen(prev => !prev)}
                            className={`flex-none w-14 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                                moreOpen || displayOverflow.some(i => i.href === activeHref)
                                    ? 'text-blue-400 bg-blue-500/10'
                                    : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                            }`}
                        >
                            <MoreHorizontal size={20} strokeWidth={1.8} />
                            <span className="text-[10px] font-semibold tracking-wide">More</span>
                        </button>
                    </>
                )}
            </div>
        </>
    );
}

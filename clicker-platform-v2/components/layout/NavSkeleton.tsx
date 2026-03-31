'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';

export function TopNavSkeleton({ forceMobile }: { forceMobile?: boolean }) {
    const { theme } = useTemplate();
    return (
        <nav
            className={`${forceMobile ? 'relative' : 'fixed top-0 left-0 right-0'} z-50 h-16 border-b px-4 flex items-center justify-between`}
            style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border || theme.colors.surface }}
        >
            {/* Left: avatar + name */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full animate-pulse" style={{ backgroundColor: `${theme.colors.foreground}15` }} />
                <div className="w-28 h-3 rounded-full animate-pulse" style={{ backgroundColor: `${theme.colors.foreground}15` }} />
            </div>
            {/* Right: button placeholder */}
            <div className="w-10 h-10 rounded-xl animate-pulse" style={{ backgroundColor: `${theme.colors.foreground}15` }} />
        </nav>
    );
}

export function BottomNavSkeleton() {
    const { theme } = useTemplate();
    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t flex items-center justify-around px-2"
            style={{
                backgroundColor: theme.colors.background + 'f0',
                borderColor: theme.colors.border,
            }}
        >
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md animate-pulse" style={{ backgroundColor: `${theme.colors.foreground}15` }} />
                    <div className="w-8 h-2 rounded-full animate-pulse" style={{ backgroundColor: `${theme.colors.foreground}10` }} />
                </div>
            ))}
        </nav>
    );
}

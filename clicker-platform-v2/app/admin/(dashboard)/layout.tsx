'use client';

import React from 'react';
import { AdminSidebar } from './AdminSidebar';
import AdminGuard from '@/components/admin/AdminGuard';
import { UserProvider } from '@/lib/user-context';
import { AdminThemeProvider, useAdminTheme } from '@/lib/use-admin-theme';
import { InboxPanelProvider } from '@/lib/inbox-panel-context';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { TopBarSlotProvider } from '@/lib/top-bar-slot-context';
import { InboxPanel } from '@/components/admin/inbox/InboxPanel';

function AdminContentWrapper({ children }: { children: React.ReactNode }) {
    const { isDark } = useAdminTheme();

    return (
        <div className={`admin-layout min-h-screen flex flex-col md:flex-row transition-colors ${isDark ? 'dark bg-neutral-950' : 'bg-gray-100'}`}>
            <AdminSidebar />
            <TopBarSlotProvider>
                <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                    <AdminTopBar />
                    <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 text-neutral-900 dark:text-neutral-100">
                        {children}
                    </main>
                </div>
            </TopBarSlotProvider>
            {/* InboxPanel lives here so it works regardless of sidebar visibility */}
            <InboxPanel />
        </div>
    );
}

// UserProvider MUST be outside AdminGuard so the guard reads from useUser()
// instead of making its own duplicate Firebase/Firestore calls.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <UserProvider>
            <AdminGuard>
                <AdminThemeProvider>
                    <InboxPanelProvider>
                        <AdminContentWrapper>
                            {children}
                        </AdminContentWrapper>
                    </InboxPanelProvider>
                </AdminThemeProvider>
            </AdminGuard>
        </UserProvider>
    );
}

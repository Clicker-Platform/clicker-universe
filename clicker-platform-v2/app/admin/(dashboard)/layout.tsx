'use client';

import React from 'react';
import { AdminSidebar } from './AdminSidebar';
import AdminGuard from '@/components/admin/AdminGuard';
import { UserProvider } from '@/lib/user-context';
import { AdminThemeProvider, useAdminTheme } from '@/lib/use-admin-theme';
import { InboxPanelProvider } from '@/lib/inbox-panel-context';

function AdminContentWrapper({ children }: { children: React.ReactNode }) {
    const { isDark } = useAdminTheme();

    return (
        <div className={`admin-layout min-h-screen flex flex-col md:flex-row transition-colors ${isDark ? 'dark bg-neutral-950' : 'bg-gray-100'}`}>
            <AdminSidebar />
            <main className="flex-1 p-4 md:p-8 min-w-0 overflow-x-hidden text-neutral-900 dark:text-neutral-100">
                {children}
            </main>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminGuard>
            <UserProvider>
                <AdminThemeProvider>
                    <InboxPanelProvider>
                        <AdminContentWrapper>
                            {children}
                        </AdminContentWrapper>
                    </InboxPanelProvider>
                </AdminThemeProvider>
            </UserProvider>
        </AdminGuard>
    );
}

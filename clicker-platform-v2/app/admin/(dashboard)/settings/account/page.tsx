'use client';

import { auth } from '@/lib/firebase';
import { AccountSecurity } from '@/components/admin/AccountSecurity';
import { SettingsSubNav } from '@/components/admin/SettingsSubNav';

export default function AccountSettingsPage() {
    const user = auth.currentUser;

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Account</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm mb-8">Manage your login credentials and account security.</p>

            <SettingsSubNav />

            <div className="mb-8 bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                <h2 className="text-sm font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider mb-4">Login Details</h2>
                <div className="space-y-3">
                    <div>
                        <p className="text-xs font-bold text-gray-400 dark:text-neutral-600 uppercase mb-1">Email Address</p>
                        <p className="font-bold text-brand-dark dark:text-neutral-100">{user?.email ?? '—'}</p>
                    </div>
                </div>
            </div>

            <AccountSecurity />
        </div>
    );
}

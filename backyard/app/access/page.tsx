'use client';

import { useState } from 'react';
import PageShell from '@/components/PageShell';
import UsersTab from '@/components/access/UsersTab';
import RolesTab from '@/components/access/RolesTab';

type Tab = 'users' | 'roles';

export default function AccessControlPage() {
    const [activeTab, setActiveTab] = useState<Tab>('users');

    return (
        <PageShell
            title="Audit & Roles"
            subtitle={activeTab === 'users' ? 'User audit across all tenants' : 'Define roles available across platform'}
        >
            <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
                        activeTab === 'users'
                            ? 'border-brand-dark text-brand-dark'
                            : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                >
                    Audit Users
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
                        activeTab === 'roles'
                            ? 'border-brand-dark text-brand-dark'
                            : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                >
                    Roles
                </button>
            </div>

            {activeTab === 'users' ? <UsersTab /> : <RolesTab />}
        </PageShell>
    );
}

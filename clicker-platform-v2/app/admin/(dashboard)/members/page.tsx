'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Users } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';

interface AccountListItem {
    uid: string;
    email: string;
    fullName: string | null;
    status: 'pending' | 'active';
    createdVia: 'register' | 'purchase';
    createdAt: number | null;
}

function StatusBadge({ status }: { status: AccountListItem['status'] }) {
    const cls: Record<AccountListItem['status'], string> = {
        active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    };
    const label: Record<AccountListItem['status'], string> = {
        active: 'Active',
        pending: 'Pending',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls[status]}`}>
            {label[status]}
        </span>
    );
}

function sourceLabel(createdVia: AccountListItem['createdVia']): string {
    return createdVia === 'purchase' ? 'Purchase' : 'Register';
}

function formatJoined(ms: number | null): string {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('id-ID');
}

export default function MembersPage() {
    const { siteId } = useSite();
    const [accounts, setAccounts] = useState<AccountListItem[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!siteId) return;
        const user = auth.currentUser;
        if (!user) return;
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/account/admin/list', {
                headers: {
                    'x-site-id': siteId,
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!res.ok) throw new Error(`list failed: ${res.status}`);
            const data = await res.json();
            setAccounts(data.accounts ?? []);
        } catch (err) {
            logger.error('account.admin.list.client.failed', { siteId, error: err });
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Members</h1>
                <p className="text-gray-500 dark:text-neutral-500 text-sm">People with an account on your store.</p>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex items-center justify-center text-gray-400 dark:text-neutral-500">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span className="text-sm">Loading…</span>
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">
                            No members yet. Members appear here after someone registers or makes a purchase.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-700">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Email</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Status</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Source</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                {accounts.map((account) => (
                                    <tr key={account.uid} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-semibold text-gray-900 dark:text-neutral-100">{account.email}</span>
                                            {account.fullName && (
                                                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{account.fullName}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={account.status} />
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-neutral-400">
                                            {sourceLabel(account.createdVia)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-neutral-400">
                                            {formatJoined(account.createdAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

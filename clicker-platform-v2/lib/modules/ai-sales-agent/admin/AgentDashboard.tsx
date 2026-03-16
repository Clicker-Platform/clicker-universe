'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { Bot, Power, Settings, MessageSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AgentDashboard() {
    const { siteId } = useSite();
    const [status, setStatus] = useState<{ enabled: boolean; name: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) return;

        const unsub = onSnapshot(doc(db, 'sites', siteId, 'modules', 'ai_sales'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setStatus({ enabled: data.enabled, name: data.name || 'Sales Agent' });
            } else {
                setStatus({ enabled: false, name: 'Sales Agent' });
            }
            setLoading(false);
        });

        return () => unsub();
    }, [siteId]);

    if (loading) return <div className="p-8">Loading agent status...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">AI Sales Overview</h1>
                    <p className="text-gray-500 dark:text-neutral-500 mt-1">Monitor your AI assistant's performance</p>
                </div>
                <Link
                    href={`/${siteId}/admin/ai-sales/settings`}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
                >
                    <Settings className="h-4 w-4" />
                    Configure Agent
                </Link>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border-[3px] border-brand-dark p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-50 rounded-xl">
                            <Bot className="h-6 w-6 text-purple-600" />
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${status?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'}`}>
                            {status?.enabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                    </div>
                    <h3 className="text-3xl font-black">{status?.name}</h3>
                    <p className="text-gray-500 dark:text-neutral-500 text-sm mt-1">Assistant Name</p>
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-2xl border-[3px] border-brand-dark p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                            <MessageSquare className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-black">0</h3>
                    <p className="text-gray-500 dark:text-neutral-500 text-sm mt-1">Total Conversations</p>
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-2xl border-[3px] border-brand-dark p-6 flex flex-col justify-center items-center text-center space-y-3">
                    <p className="text-gray-500 dark:text-neutral-500 text-sm">Want to customize behavior?</p>
                    <Link
                        href={`/${siteId}/admin/ai-sales/settings`}
                        className="flex items-center gap-2 text-brand-dark font-bold hover:underline"
                    >
                        Go to Settings <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>

            {/* Placeholder for Recent Chats */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-neutral-800">
                    <h3 className="font-bold text-lg">Recent Conversations</h3>
                </div>
                <div className="p-12 text-center text-gray-400 dark:text-neutral-600">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No conversations recorded yet.</p>
                </div>
            </div>
        </div>
    );
}

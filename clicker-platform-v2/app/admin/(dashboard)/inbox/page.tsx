'use client';

import { useEffect } from 'react';
import { useInboxPanel } from '@/lib/inbox-panel-context';
import { Mail, Inbox } from 'lucide-react';

export default function InboxPage() {
    const { open, isOpen } = useInboxPanel();

    useEffect(() => {
        if (!isOpen) open();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally run once on mount to auto-open the inbox panel

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full mb-4">
                <Inbox size={28} className="text-gray-400 dark:text-neutral-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                <Mail size={20} /> Inbox
            </h1>
            <p className="text-gray-500 dark:text-neutral-400 font-medium text-sm">
                Your inbox is open in the side panel.
            </p>
        </div>
    );
}

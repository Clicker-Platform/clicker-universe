'use client';

import Link from 'next/link';
import { ExternalLink, Clock } from 'lucide-react';
import { ReservationBreadcrumb } from '../components/ReservationBreadcrumb';

export default function CalendarClient() {
    return (
        <div>
            <ReservationBreadcrumb currentPage="Calendar Settings" />
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Calendar Settings</h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium">Manage your business hours and availability</p>
                </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm p-8 max-w-xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-brand-dark/10 rounded-xl flex items-center justify-center">
                        <Clock size={20} className="text-brand-dark" />
                    </div>
                    <h2 className="text-lg font-bold text-brand-dark">Business Hours</h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-neutral-400 mb-6">
                    Service availability is now driven by your <strong>Business Profile → Schedule</strong>.
                    Configure your open days and hours there — the booking form picks them up automatically.
                </p>
                <Link
                    href="/admin/business/profile"
                    className="inline-flex items-center gap-2 bg-studio-blue text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-studio-blue/85 transition-colors"
                >
                    Go to Business Profile
                    <ExternalLink size={15} />
                </Link>
            </div>
        </div>
    );
}

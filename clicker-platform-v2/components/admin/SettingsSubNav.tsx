'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSite } from '@/lib/site-context';

const TABS = [
    { label: 'Account', path: '/admin/settings/account' },
    { label: 'Identity', path: '/admin/settings/identity' },
    { label: 'Business', path: '/admin/settings/business' },
] as const;

export function SettingsSubNav() {
    const pathname = usePathname();
    const { tenantSlug, isSubdomain } = useSite();
    const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';

    return (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-8">
            {TABS.map((tab) => {
                const href = `${baseUrl}${tab.path}`;
                const isActive = pathname === href || pathname?.startsWith(href);
                return (
                    <Link
                        key={tab.path}
                        href={href}
                        className={`px-5 py-2 rounded-full font-bold whitespace-nowrap transition-all text-sm ${
                            isActive
                                ? 'bg-brand-dark text-brand-green shadow-md'
                                : 'bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-500 border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800'
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}

'use client';

import { ExternalLink, Globe, LayoutTemplate, Type, Navigation } from 'lucide-react';
import Link from 'next/link';
import { useSite } from '@/lib/site-context';

export function ChromeHeaderPanel({ siteId }: { siteId: string }) {
    const { tenantSlug, isSubdomain } = useSite();
    const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Global Badge */}
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center shadow-lg text-blue-400">
                        <Globe size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-neutral-200 text-sm">Header Navigation</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="flex w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Global Setting</span>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-sm text-neutral-400 leading-relaxed">
                The header appears on every page of your site. It automatically pulls your logo and brand name from your Business settings.
            </p>

            <div className="bg-neutral-800/50 rounded-xl p-5 border border-neutral-800">
                <h5 className="font-bold text-neutral-200 text-sm mb-3 flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-neutral-500" /> What's shown here:
                </h5>
                <ul className="space-y-2 text-sm text-neutral-400">
                    <li className="flex items-center gap-2">• Business Logo & Name</li>
                    <li className="flex items-center gap-2">• Top Navigation Links</li>
                    <li className="flex items-center gap-2">• Call-to-Action Button (optional)</li>
                </ul>
            </div>

            <Link
                href={`${baseUrl}/admin/navigation`}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-xl font-bold hover:bg-neutral-700 hover:border-neutral-600 transition-all shadow-sm active:scale-[0.98]"
            >
                Edit Navigation Settings
                <ExternalLink size={16} />
            </Link>
            <p className="text-xs text-center text-neutral-500">
                Manage your menus and buttons in the Navigation area.
            </p>
        </div>
    );
}

export function ChromeFooterPanel({
    footerText,
    onFooterTextChange
}: {
    footerText: string;
    onFooterTextChange: (val: string) => void;
}) {
    const { tenantSlug, isSubdomain } = useSite();
    const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Global Badge */}
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center shadow-lg text-blue-400">
                        <Globe size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-neutral-200 text-sm">Site Footer</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="flex w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Global Setting</span>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-sm text-neutral-400 leading-relaxed">
                The footer appears at the very bottom of every page.
            </p>

            <div className="space-y-4 pt-4 border-t border-neutral-800">
                <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-neutral-300 mb-2">
                        <Type size={16} className="text-neutral-500" />
                        Footer Text
                    </label>
                    <input
                        type="text"
                        value={footerText || ''}
                        onChange={(e) => onFooterTextChange(e.target.value)}
                        className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                        placeholder="e.g., © 2026 My Business. All rights reserved."
                    />
                    <p className="text-xs text-neutral-500 mt-2">
                        This text is saved automatically along with your page settings.
                    </p>
                </div>
            </div>

            <div className="pt-4 border-t border-neutral-800">
                <h5 className="font-bold text-neutral-200 text-sm mb-3">Bottom Navigation & FAB</h5>
                <Link
                    href={`${baseUrl}/admin/navigation`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-xl font-bold hover:bg-neutral-700 hover:text-neutral-100 transition-all shadow-sm active:scale-[0.98]"
                >
                    Edit Navigation Settings
                    <ExternalLink size={16} />
                </Link>
            </div>
        </div>
    );
}

export function ChromeBottomNavPanel() {
    const { tenantSlug, isSubdomain } = useSite();
    const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Global Badge */}
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center shadow-lg text-blue-400">
                        <Navigation size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-neutral-200 text-sm">Bottom Navigation</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="flex w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Global Setting</span>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-sm text-neutral-400 leading-relaxed">
                The bottom navigation bar appears on every page. Configure the nav items and floating action button (FAB) from the Navigation settings.
            </p>

            <div className="bg-neutral-800/50 rounded-xl p-5 border border-neutral-800">
                <h5 className="font-bold text-neutral-200 text-sm mb-3 flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-neutral-500" /> What&apos;s shown here:
                </h5>
                <ul className="space-y-2 text-sm text-neutral-400">
                    <li className="flex items-center gap-2">• Bottom Navigation Links</li>
                    <li className="flex items-center gap-2">• Center FAB Button (optional)</li>
                </ul>
            </div>

            <Link
                href={`${baseUrl}/admin/navigation`}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-xl font-bold hover:bg-neutral-700 hover:border-neutral-600 transition-all shadow-sm active:scale-[0.98]"
            >
                Edit Navigation Settings
                <ExternalLink size={16} />
            </Link>
            <p className="text-xs text-center text-neutral-500">
                Manage bottom nav items and the FAB in the Navigation area.
            </p>
        </div>
    );
}

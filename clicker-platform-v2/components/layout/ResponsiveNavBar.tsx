'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { BusinessProfile, NavigationItem, Form } from '@/data/mockData';
import Image from 'next/image';
import Link from 'next/link';
import { FormModal } from '@/components/FormModal';
import { Menu, ArrowLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { useNavigation } from '@/components/layout/NavigationProvider';
import { useDeviceView } from '@/components/DeviceViewContext';
import { TopNavSkeleton } from '@/components/layout/NavSkeleton';

interface ResponsiveNavBarProps {
    profile: BusinessProfile;
    /** @deprecated siteId is now sourced from NavigationProvider — kept for backward compat */
    siteId?: string;
    forceMobile?: boolean;
    isSubPage?: boolean;
    pageTitle?: string;
    /** Canvas Studio preview: intercepts nav clicks instead of real navigation */
    onNavigate?: (href: string, item: NavigationItem) => void;
}

export const ResponsiveNavBar: React.FC<ResponsiveNavBarProps> = ({
    profile,
    siteId,
    forceMobile = false,
    isSubPage = false,
    pageTitle,
    onNavigate,
}) => {
    const router = useRouter();
    const { tenantSlug, isSubdomain } = useSite();
    const { theme, templateId } = useTemplate();
    const deviceView = useDeviceView();
    const isPreview = deviceView !== 'responsive';
    const { layout } = theme;

    const { topNav, topNavActions, headerStyle, loading, formCache } = useNavigation();

    const [selectedForm, setSelectedForm] = useState<Form | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navActions = useMemo(
        () => topNavActions ?? { cta: { enabled: false, label: 'Order', linkType: 'url' as const, linkValue: '#' } },
        [topNavActions]
    );

    const openChat = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ai-sales-agent:open'));
        }
    }, []);

    const getHref = useCallback((val: string) => resolveNavHref(val, tenantSlug, isSubdomain), [tenantSlug, isSubdomain]);

    const handleItemClick = useCallback(async (e: React.MouseEvent, item: NavigationItem) => {
        if (onNavigate) {
            e.preventDefault();
            onNavigate(getHref(item.value), item);
            return;
        }
        if (item.value === 'action:chat' || (item.type as string) === 'action-chat') {
            e.preventDefault();
            openChat();
            return;
        }
        if (item.type === 'form' && item.formId) {
            e.preventDefault();
            const cached = formCache[item.formId];
            if (cached) {
                setSelectedForm(cached);
                setIsFormOpen(true);
            } else if (siteId) {
                // Fallback: on-demand fetch for cache misses (lazy-loaded to keep Firebase out of initial bundle)
                try {
                    const { getDoc, doc } = await import('firebase/firestore');
                    const { db } = await import('@/lib/firebase');
                    const snap = await getDoc(doc(db, 'sites', siteId, 'forms', item.formId));
                    if (snap.exists() && snap.data().isPublished !== false) {
                        setSelectedForm({ id: snap.id, ...snap.data() } as Form);
                        setIsFormOpen(true);
                    }
                } catch (err) {
                    console.error('ResponsiveNavBar: form fetch error', err);
                }
            }
        }
    }, [formCache, siteId, openChat, onNavigate, getHref]);

    const isMobileOnly = layout?.navMode === 'mobile-only';

    if (isMobileOnly) return null;
    if (loading) return <TopNavSkeleton forceMobile={forceMobile || isPreview} />;

    // Template-adaptive colors
    const navBg = headerStyle.bgColor ?? theme.colors.background;
    const navBorder = headerStyle.showBorder ? (theme.colors.border || '#e5e7eb') : 'transparent';
    const textMuted = `${theme.colors.foreground}80`;

    return (
        <>
            <nav
                className={`${(forceMobile || isPreview) ? 'relative z-10' : 'fixed top-0 left-0 right-0 z-50'} h-16 border-b px-4 flex items-center justify-between transition-all duration-300`}
                style={{ backgroundColor: navBg, borderColor: navBorder }}
            >
                {/* Left: Logo/Back Arrow + Brand Name */}
                <div className="flex items-center gap-3 md:gap-4 relative z-10 overflow-hidden max-w-[60%] md:max-w-none">
                    {isSubPage ? (
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); if (!forceMobile) router.back(); }}
                            className="w-10 h-10 flex-shrink-0 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors -ml-2"
                            style={{ color: theme.colors.foreground }}
                        >
                            <ArrowLeft size={24} />
                        </button>
                    ) : (
                        <Link href={siteId ? `/${siteId}` : '/'} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                            <div className="bg-white rounded-full flex items-center justify-center w-10 h-10 overflow-hidden shadow-sm">
                                {profile.avatarUrl ? (
                                    <Image
                                        src={profile.avatarUrl}
                                        alt={profile.name}
                                        width={40}
                                        height={40}
                                        className="object-cover"
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-bold text-sm text-black">
                                        {profile.name?.charAt(0) || '?'}
                                    </div>
                                )}
                            </div>
                        </Link>
                    )}
                    <h1
                        className="font-bold tracking-[0.1em] md:tracking-[0.3em] uppercase text-sm md:text-lg whitespace-nowrap truncate"
                        style={{ color: theme.colors.foreground }}
                    >
                        {isSubPage ? pageTitle : profile.name}
                    </h1>
                </div>

                {/* Right: Hamburger (Mobile/Tablet) or Links (Desktop) */}
                <div className="flex items-center gap-4 relative z-10">
                    {/* Desktop Links */}
                    <div className={`${forceMobile ? 'hidden' : 'hidden lg:flex'} items-center gap-6 mr-4`}>
                        {topNav.map((item) => (
                            <Link
                                key={item.id}
                                href={getHref(item.value)}
                                onClick={(e) => handleItemClick(e, item)}
                                className="font-bold text-xs uppercase tracking-[0.2em] hover:opacity-100 transition-opacity"
                                style={{ color: textMuted }}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTA */}
                    {navActions.cta?.enabled && (
                        <div className={forceMobile ? 'hidden' : 'hidden lg:block'}>
                            {(() => {
                                const { label, linkType, linkValue, formId } = navActions.cta!;
                                const actionItem = { id: '', label: '', type: linkType, formId, value: linkValue } as NavigationItem;
                                return (
                                    <Link
                                        href={getHref(linkValue)}
                                        onClick={(e) => handleItemClick(e, actionItem)}
                                        className="px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.15em] hover:opacity-90 transition-opacity"
                                        style={{ backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff' }}
                                    >
                                        {label || 'Order'}
                                    </Link>
                                );
                            })()}
                        </div>
                    )}

                    {/* Mobile Menu Toggle — only shown when there's something to show */}
                    {(topNav.length > 0 || navActions.cta?.enabled) && <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setIsMenuOpen(!isMenuOpen); }}
                        className={`${forceMobile ? 'block' : 'lg:hidden'} p-2 transition-all ${templateId === 'mrb-light' ? '' : 'rounded-xl border'}`}
                        style={templateId === 'mrb-light' ? { color: theme.colors.foreground } : {
                            backgroundColor: `${theme.colors.surface || theme.colors.background}`,
                            borderColor: navBorder,
                            color: textMuted,
                        }}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen
                            ? <X className="w-6 h-6" style={{ color: theme.colors.foreground }} />
                            : <Menu className="w-6 h-6" />
                        }
                    </button>}
                </div>
            </nav>

            {/* Mobile/Tablet Menu Overlay */}
            {isMenuOpen && (
                <div
                    className={`${(forceMobile || isPreview) ? 'absolute z-[9]' : 'fixed z-[45]'} inset-0 backdrop-blur-3xl ${forceMobile ? 'flex' : 'lg:hidden flex'} flex-col pt-32 px-10 pb-16 transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
                    style={{ backgroundColor: `${theme.colors.background}f5` }}
                >
                    <div className="flex flex-col gap-10 items-center text-center">
                        {topNav.map((item) => (
                            <Link
                                key={item.id}
                                href={getHref(item.value)}
                                onClick={(e) => { handleItemClick(e, item); setIsMenuOpen(false); }}
                                className="text-3xl font-black uppercase tracking-[0.3em] transition-opacity hover:opacity-80"
                                style={{ color: theme.colors.foreground }}
                            >
                                {item.label}
                            </Link>
                        ))}

                        {navActions.cta?.enabled && (
                            <div className="mt-8 w-full max-w-sm">
                                {(() => {
                                    const { label, linkType, linkValue, formId } = navActions.cta!;
                                    const actionItem = { id: '', label: '', type: linkType, formId, value: linkValue } as NavigationItem;
                                    return (
                                        <Link
                                            href={getHref(linkValue)}
                                            onClick={(e) => { handleItemClick(e, actionItem); setIsMenuOpen(false); }}
                                            className="block w-full py-5 rounded-full font-black text-sm uppercase tracking-[0.3em] text-center shadow-2xl"
                                            style={{ backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff' }}
                                        >
                                            {label || 'Order Now'}
                                        </Link>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <FormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                form={selectedForm as Form}
                siteId={siteId || ''}
            />
        </>
    );
};

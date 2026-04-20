'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import Link from 'next/link';
import { FormModal } from '@/components/FormModal';
import { ICON_MAP } from '@/data/icons';
import { Home, PlusCircle } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { useNavigation } from '@/components/layout/NavigationProvider';
import { BottomNavSkeleton } from '@/components/layout/NavSkeleton';

interface BottomNavBarProps {
    previewMode?: boolean;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ previewMode = false }) => {
    const { theme } = useTemplate();
    const deviceView = useDeviceView();
    const { siteId, tenantSlug, isSubdomain } = useSite();
    const { layout } = theme;

    const { bottomNav, fab, bottomNavStyle, loading, formCache } = useNavigation();

    const [selectedForm, setSelectedForm] = useState<any>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const getIcon = (name: string) => ICON_MAP[name as keyof typeof ICON_MAP] || Home;

    const getHref = (val: string) => resolveNavHref(val, tenantSlug, isSubdomain);

    const openChat = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ai-sales-agent:open'));
        }
    };

    const handleItemClick = useCallback(async (e: React.MouseEvent, item: any) => {
        if (item.type === 'chat' || item.type === 'action-chat' || item.value === 'action:chat') {
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
                        setSelectedForm({ id: snap.id, ...snap.data() });
                        setIsFormOpen(true);
                    }
                } catch (err) {
                    console.error('BottomNavBar: form fetch error', err);
                }
            }
        }
    }, [formCache, siteId]);

    const midPoint = useMemo(() => Math.ceil(bottomNav.length / 2), [bottomNav]);
    const leftItems = useMemo(() => bottomNav.slice(0, midPoint), [bottomNav, midPoint]);
    const rightItems = useMemo(() => bottomNav.slice(midPoint), [bottomNav, midPoint]);

    // Render ONLY if explicitly enabled by the template — after all hooks
    if (!layout?.showBottomNav) return null;
    
    if (loading) return <BottomNavSkeleton />;

    const hasBottomNavItems = bottomNav && bottomNav.length > 0;
    const hasFabEnabled = fab?.enabled === true;
    
    // By logic, no menu = no bottom navigation
    if (!hasBottomNavItems && !hasFabEnabled) return null;

    const FabIcon = fab?.icon ? getIcon(fab.icon) : PlusCircle;

    const barBg = bottomNavStyle.bgColor ?? (theme.colors.background + 'f0');
    const borderColor = bottomNavStyle.showBorder ? (theme.colors.border || '#e5e7eb') : 'transparent';
    const inactiveColor = theme.colors.foreground + '60';
    const fabBg = theme.colors.accent || theme.colors.primary;

    const positionClass = previewMode
        ? (deviceView === 'desktop' ? 'hidden' : 'relative w-full')
        : `${dv(deviceView, '', 'md:hidden')} fixed bottom-0 left-0 right-0 z-50`;

    return (
        <>
            <nav
                className={`${positionClass} h-16 backdrop-blur-md border-t flex items-center justify-around px-2 safe-area-bottom`}
                style={{ backgroundColor: barBg, borderColor }}
            >
                {leftItems.map((item) => {
                    const IconComponent = getIcon(item.icon || '');
                    return (
                        <Link
                            key={item.id}
                            href={getHref(item.value)}
                            onClick={(e) => handleItemClick(e, item)}
                            className="flex flex-col items-center justify-center w-12 h-full transition-colors"
                            style={{ color: inactiveColor }}
                        >
                            <IconComponent size={22} />
                            <span className="text-[10px] font-medium mt-1">{item.label}</span>
                        </Link>
                    );
                })}

                {fab?.enabled && (
                    <div className="relative -top-5">
                        <Link
                            href={getHref(fab.value)}
                            onClick={(e) => handleItemClick(e, fab)}
                            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transform active:scale-95 transition-all"
                            style={{ backgroundColor: fabBg, boxShadow: `0 0 20px ${fabBg}60` }}
                        >
                            <FabIcon size={24} />
                        </Link>
                    </div>
                )}

                {rightItems.map((item) => {
                    const IconComponent = getIcon(item.icon || '');
                    return (
                        <Link
                            key={item.id}
                            href={getHref(item.value)}
                            onClick={(e) => handleItemClick(e, item)}
                            className="flex flex-col items-center justify-center w-12 h-full transition-colors"
                            style={{ color: inactiveColor }}
                        >
                            <IconComponent size={22} />
                            <span className="text-[10px] font-medium mt-1">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <FormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                form={selectedForm}
                siteId={siteId}
            />
        </>
    );
};

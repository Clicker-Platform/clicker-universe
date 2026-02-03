'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { BusinessProfile } from '@/data/mockData';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { FormModal } from '@/components/FormModal';
import { Home, Menu, Search, ShoppingBag } from 'lucide-react';
import { useSite } from '@/lib/site-context';

interface ResponsiveNavBarProps {
    profile: BusinessProfile;
}

export const ResponsiveNavBar: React.FC<ResponsiveNavBarProps> = ({ profile }) => {
    const { theme } = useTemplate();
    const { layout } = theme;
    const [navItems, setNavItems] = React.useState<any[]>([]);
    const [navActions, setNavActions] = React.useState<any>({ showSearch: true, cta: { enabled: true, label: 'Order', linkType: 'url', linkValue: '#' } });
    const [selectedForm, setSelectedForm] = React.useState<any>(null);
    const [isFormOpen, setIsFormOpen] = React.useState(false);

    // Decoupled Open Chat Helper
    const openChat = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ai-sales-agent:open'));
        }
    };

    const handleItemClick = async (e: React.MouseEvent, item: any) => {
        // Handle Chat Actions
        if (item.value === 'action:chat' || item.type === 'action-chat') {
            e.preventDefault();
            openChat();
            return;
        }

        if (item.type === 'form' && item.formId) {
            e.preventDefault();
            try {
                const snap = await getDoc(doc(db, 'forms', item.formId));
                if (snap.exists()) {
                    setSelectedForm({ id: snap.id, ...snap.data() });
                    setIsFormOpen(true);
                }
            } catch (error) {
                console.error("Error loading form:", error);
            }
        }
    };

    const { siteId } = useSite();
    React.useEffect(() => {
        if (!siteId) return;
        const unsub = onSnapshot(
            doc(db, 'sites', siteId, 'content', 'siteSettings'),
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.navigation?.topNav?.length > 0) {
                        setNavItems(data.navigation.topNav);
                    } else {
                        // Default Fallback
                        setNavItems([
                            { id: 'home', label: 'Home', value: '/', icon: 'Home' },
                            { id: 'catalog', label: 'Catalog', value: '/catalog', icon: 'ShoppingBag' }
                        ]);
                    }

                    if (data.navigation?.topNavActions) {
                        setNavActions(data.navigation.topNavActions);
                    }
                }
            },
            (error) => {
                console.error("ResponsiveNavBar: Firestore listener error:", error);
            }
        );
        return () => unsub();
    }, []);

    // 1. If Nav Mode is 'mobile-only', we assume the design doesn't use a top bar 
    // (classic link-in-bio style where the header is in the content flow).
    if (layout?.navMode === 'mobile-only') {
        return null;
    }

    // Helper to resolve Href
    const getHref = (val: string) => {
        if (val === 'action:home' || val === 'action:homepage') return '/';
        if (val?.startsWith('action:')) return '#';
        return val || '#';
    };

    // 2. Adaptive Mode:
    // Mobile: Hidden (or maybe a hamburger menu later?)
    // Desktop: Sticky Top Bar
    return (
        <>
            <nav className="
                hidden md:flex 
                fixed top-0 left-0 right-0 z-50 
                h-16 bg-white/90 backdrop-blur-md border-b border-gray-200
                px-6 items-center justify-between
                transition-all duration-300
            ">
                {/* Left: Brand */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 relative rounded-full overflow-hidden border border-gray-100">
                        {profile.avatarUrl ? (
                            <Image
                                src={profile.avatarUrl}
                                alt={profile.name}
                                fill
                                sizes="32px"
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-theme-primary flex items-center justify-center font-bold text-xs">
                                {profile.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <span className="font-bold text-lg text-theme-foreground tracking-tight">
                        {profile.name}
                    </span>
                </div>

                {/* Center: Links (Dynamic) */}
                <div className="flex items-center gap-6">
                    {navItems.map((item) => (
                        <Link
                            key={item.id}
                            href={getHref(item.value)}
                            onClick={(e) => handleItemClick(e, item)}
                            className="font-medium text-sm text-gray-600 hover:text-brand-dark transition-colors"
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">


                    {navActions.cta?.enabled && (
                        (() => {
                            // Helper to Render Dynamic CTA
                            const { label, linkType, linkValue, formId, pageId } = navActions.cta;

                            // 1. Construct navigation item-like object for handler
                            const actionItem = {
                                type: linkType,
                                formId: formId,
                                value: linkValue
                            };

                            const handleClick = (e: React.MouseEvent) => handleItemClick(e, actionItem);

                            return (
                                <Link
                                    href={linkValue || '#'}
                                    onClick={handleClick}
                                    className="flex items-center gap-2 px-4 py-2 bg-theme-primary text-theme-foreground rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
                                >
                                    <ShoppingBag size={16} />
                                    <span>{label || 'Order'}</span>
                                </Link>
                            )
                        })()
                    )}
                </div>
            </nav>

            <FormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                form={selectedForm}
            />
        </>
    );
};

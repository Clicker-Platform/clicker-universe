'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { BusinessProfile } from '@/data/mockData';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { FormModal } from '@/components/FormModal';
import { Home, Menu, Search, ShoppingBag, ArrowLeft, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useRouter } from 'next/navigation';

interface ResponsiveNavBarProps {
    profile: BusinessProfile;
    siteId: string;
    forceMobile?: boolean;
    isSubPage?: boolean;
    pageTitle?: string;
}

export const ResponsiveNavBar: React.FC<ResponsiveNavBarProps> = ({ 
    profile, 
    siteId, 
    forceMobile = false,
    isSubPage = false,
    pageTitle
}) => {
    const router = useRouter();
    const { theme } = useTemplate();
    const { layout } = theme;
    const [navItems, setNavItems] = React.useState<any[]>([]);
    const [navActions, setNavActions] = React.useState<any>({ showSearch: true, cta: { enabled: true, label: 'Order', linkType: 'url', linkValue: '#' } });
    const [selectedForm, setSelectedForm] = React.useState<any>(null);
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

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
                const snap = await getDoc(doc(db, 'sites', siteId, 'forms', item.formId));
                if (snap.exists() && snap.data().isPublished !== false) {
                    setSelectedForm({ id: snap.id, ...snap.data() });
                    setIsFormOpen(true);
                }
            } catch (error) {
                console.error("Error loading form:", error);
            }
        }
    };

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
    }, [siteId]);

    // 1. If Nav Mode is 'mobile-only', we assume the design doesn't use a top bar 
    // (classic link-in-bio style where the header is in the content flow).
    const isMobileOnly = layout?.navMode === 'mobile-only';

    // Helper to resolve Href
    const getHref = (val: string) => {
        if (val === 'action:home' || val === 'action:homepage') return '/';
        if (val?.startsWith('action:')) return '#';
        return val || '#';
    };

    if (isMobileOnly) {
        return null;
    }

    // 2. Adaptive Mode:
    // Mobile/Tablet: Hamburger menu
    // Desktop: Inline links
    return (
        <>
            <nav 
                className={`${forceMobile ? 'relative' : 'fixed top-0 left-0 right-0'} z-50 h-16 border-b px-4 flex items-center justify-between transition-all duration-300`}
                style={{ 
                    backgroundColor: '#0a0a0a',
                    borderColor: '#111827', // darker gray-900 for subtle border
                }}
            >
                {/* Left: Logo/Back Arrow + Brand Name */}
                <div className="flex items-center gap-3 md:gap-4 relative z-10 overflow-hidden max-w-[60%] md:max-w-none">
                    {isSubPage ? (
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                if (!forceMobile) router.back();
                            }}
                            className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors -ml-2"
                        >
                            <ArrowLeft size={24} />
                        </button>
                    ) : (
                        <Link href={`/${siteId}`} className="flex-shrink-0 group hover:opacity-80 transition-opacity">
                            <div className="bg-white rounded-full flex items-center justify-center w-10 h-10 overflow-hidden shadow-sm">
                                {profile.avatarUrl ? (
                                    <Image
                                        src={profile.avatarUrl}
                                        alt={profile.name}
                                        width={40}
                                        height={40}
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-bold text-sm text-black">
                                        {profile.name?.charAt(0) || '?'}
                                    </div>
                                )}
                            </div>
                        </Link>
                    )}

                    <h1 className="text-white font-bold tracking-[0.1em] md:tracking-[0.3em] uppercase text-sm md:text-lg whitespace-nowrap truncate">
                        {isSubPage ? pageTitle : profile.name}
                    </h1>
                </div>

                {/* Right: Hamburger (Mobile/Tablet) or Links (Desktop) */}
                <div className="flex items-center gap-4 relative z-10">
                    {/* Desktop Links */}
                    <div className={`${forceMobile ? 'hidden' : 'hidden lg:flex'} items-center gap-6 mr-4`}>
                        {navItems.map((item) => (
                            <Link
                                key={item.id}
                                href={getHref(item.value)}
                                onClick={(e) => handleItemClick(e, item)}
                                className="font-bold text-xs uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTA */}
                    {navActions.cta?.enabled && (
                        <div className={forceMobile ? 'hidden' : 'hidden lg:block'}>
                            {(() => {
                                const { label, linkType, linkValue, formId } = navActions.cta;
                                const actionItem = { type: linkType, formId, value: linkValue };
                                const handleClick = (e: React.MouseEvent) => handleItemClick(e, actionItem);
                                
                                return (
                                    <Link
                                        href={getHref(linkValue)}
                                        onClick={handleClick}
                                        className="px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.15em] hover:opacity-90 transition-opacity"
                                        style={{ 
                                            backgroundColor: theme.colors.primary, 
                                            color: theme.colors.foreground 
                                        }}
                                    >
                                        {label || 'Order'}
                                    </Link>
                                )
                            })()}
                        </div>
                    )}

                    {/* Mobile Menu Toggle */}
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className={`${forceMobile ? 'block' : 'lg:hidden'} p-2 rounded-xl bg-[#111111] border border-gray-800 text-gray-400 hover:text-white transition-all`}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </nav>

            {/* Mobile/Tablet Menu Overlay */}
            {isMenuOpen && (
                <div className={`${forceMobile ? 'absolute' : 'fixed'} inset-0 z-[45] bg-black backdrop-blur-3xl ${forceMobile ? 'flex' : 'lg:hidden flex'} flex-col pt-32 px-10 pb-16 transition-all duration-300 animate-in fade-in slide-in-from-top-4`}>
                    <div className="flex flex-col gap-10 items-center text-center">
                        {navItems.map((item) => (
                            <Link
                                key={item.id}
                                href={getHref(item.value)}
                                onClick={(e) => {
                                    handleItemClick(e, item);
                                    setIsMenuOpen(false);
                                }}
                                className="text-3xl font-black uppercase tracking-[0.3em] text-white hover:text-white transition-colors"
                            >
                                {item.label}
                            </Link>
                        ))}

                        {navActions.cta?.enabled && (
                            <div className="mt-8 w-full max-w-sm">
                                {(() => {
                                    const { label, linkType, linkValue, formId } = navActions.cta;
                                    const actionItem = { type: linkType, formId, value: linkValue };
                                    const handleClick = (e: React.MouseEvent) => {
                                        handleItemClick(e, actionItem);
                                        setIsMenuOpen(false);
                                    };
                                    
                                    return (
                                        <Link
                                            href={getHref(linkValue)}
                                            onClick={handleClick}
                                            className="block w-full py-5 rounded-full font-black text-sm uppercase tracking-[0.3em] text-center shadow-2xl"
                                            style={{ 
                                                backgroundColor: theme.colors.primary, 
                                                color: theme.colors.foreground 
                                            }}
                                        >
                                            {label || 'Order Now'}
                                        </Link>
                                    )
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <FormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                form={selectedForm}
                siteId={siteId}
            />
        </>
    );
};

'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { FormModal } from '@/components/FormModal';
import { ICON_MAP } from '@/data/icons';
import { Home, PlusCircle } from 'lucide-react';
import { useSite } from '@/lib/site-context';

interface BottomNavBarProps {
    previewMode?: boolean;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ previewMode = false }) => {
    const { theme } = useTemplate();
    const { siteId } = useSite();
    const { layout } = theme;
    const [navItems, setNavItems] = React.useState<any[]>([]);
    const [fab, setFab] = React.useState<any>(null);
    const [selectedForm, setSelectedForm] = React.useState<any>(null);
    const [isFormOpen, setIsFormOpen] = React.useState(false);

    // Decoupled Open Chat Helper
    const openChat = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ai-sales-agent:open'));
        }
    };

    // Icon mapping helper
    const getIcon = (name: string) => {
        return ICON_MAP[name] || Home;
    };

    const handleItemClick = async (e: React.MouseEvent, item: any) => {
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
        } else if (item.type === 'chat' || item.type === 'action-chat' || item.value === 'action:chat') {
            e.preventDefault();
            openChat();
        }
    };

    React.useEffect(() => {
        if (!siteId) return;

        const unsub = onSnapshot(
            doc(db, 'sites', siteId, 'content', 'siteSettings'),
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.navigation?.bottomNav?.length > 0) {
                        setNavItems(data.navigation.bottomNav);
                    } else {
                        // Default Fallback
                        setNavItems([
                            { id: 'home', label: 'Home', value: '/', icon: 'Home' },
                            { id: 'search', label: 'Search', value: '/search', icon: 'Search' },
                            { id: 'saved', label: 'Saved', value: '/saved', icon: 'Heart' },
                            { id: 'profile', label: 'Profile', value: '/profile', icon: 'User' }
                        ]);
                    }
                    // FAB Config
                    setFab(data.navigation?.fab || null);
                }
            },
            (error) => {
                console.error("BottomNavBar: Firestore listener error:", error);
            }
        );
        return () => unsub();
    }, []);

    // Render ONLY if explicitly enabled by the template
    if (!layout?.showBottomNav) {
        return null;
    }

    // Helper to resolve Href
    const getHref = (val: string) => {
        if (val === 'action:home' || val === 'action:homepage') return '/';
        if (val?.startsWith('action:')) return '#';
        return val || '#';
    };

    const midPoint = Math.ceil(navItems.length / 2);
    const leftItems = navItems.slice(0, midPoint);
    const rightItems = navItems.slice(midPoint);

    // FAB Icon
    const FabIcon = fab?.icon ? getIcon(fab.icon) : PlusCircle;

    // Theme-derived styles
    const barBg = theme.colors.background + 'f0'; // ~94% opacity
    const borderColor = theme.colors.border;
    const inactiveColor = theme.colors.foreground + '60';
    const activeColor = theme.colors.primary;
    const fabBg = theme.colors.accent || theme.colors.primary;

    // Positioning: fixed on live site, relative in canvas preview
    const positionClass = previewMode
        ? 'relative w-full'
        : 'md:hidden fixed bottom-0 left-0 right-0 z-50';

    return (
        <>
            <nav
                className={`
                    ${positionClass}
                    h-16 backdrop-blur-md border-t
                    flex items-center justify-around px-2
                    safe-area-bottom
                `}
                style={{
                    backgroundColor: barBg,
                    borderColor: borderColor,
                }}
            >
                {leftItems.map((item) => {
                    const IconComponent = getIcon(item.icon);
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

                {/* Central FAB - Only render if configured */}
                {fab && fab.enabled && (
                    <div className="relative -top-5">
                        <Link
                            href={getHref(fab.value)}
                            onClick={(e) => handleItemClick(e, fab)}
                            className="
                                w-14 h-14 rounded-full
                                flex items-center justify-center
                                text-white shadow-lg
                                transform active:scale-95 transition-all
                            "
                            style={{
                                backgroundColor: fabBg,
                                boxShadow: `0 0 20px ${fabBg}60`,
                            }}
                        >
                            <FabIcon size={24} />
                        </Link>
                    </div>
                )}

                {rightItems.map((item) => {
                    const IconComponent = getIcon(item.icon);
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

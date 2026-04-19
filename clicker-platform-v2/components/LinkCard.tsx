'use client';

import React from 'react';
import { LinkItem } from '@/data/mockData';
import { ArrowRight, ExternalLink, ShoppingBag } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ICON_MAP } from '@/data/icons';

import { FormModal } from '@/components/FormModal';
import { TemplateContext } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';

interface LinkCardProps {
    item: LinkItem;
    siteId?: string;
    tenantSlug?: string;
}

export const LinkCard: React.FC<LinkCardProps> = ({ item, siteId, tenantSlug }) => {
    const isHighlight = item.highlight;
    // Resolve Icon client-side
    const Icon = item.iconName && ICON_MAP[item.iconName] ? ICON_MAP[item.iconName] : ShoppingBag;

    const { theme } = React.useContext(TemplateContext) || { theme: { cardStyle: 'brutalist' } as any };
    // Safe check for theme context

    // Determine style logic based on theme
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';
    const isOutlined = theme.cardVariant === 'outlined'; // Keep for specific variant logic if needed, but isClean dominates general layout

    // Helper: isBrutalist implies (!isClean)
    // Legacy mapping: isOutlined was used as a rough proxy for Clean/Sojourner. 
    // Now we strictly use isClean for the structure change.

    const { track } = useAnalytics();

    // Form Modal State
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [formData, setFormData] = React.useState<any>(null);
    const [isLoadingForm, setIsLoadingForm] = React.useState(false);

    const getTenantAwareUrl = (url: string): string =>
        resolveNavHref(url, effectiveTenantSlug, isSubdomain);

    const { siteId: contextSiteId, tenantSlug: contextTenantSlug, isSubdomain } = useSite();
    const effectiveSiteId = siteId || contextSiteId;
    const effectiveTenantSlug = tenantSlug || contextTenantSlug || '';

    const handleClick = async (e: React.MouseEvent) => {
        track({ type: 'link_click', id: item.id, siteId: effectiveSiteId });

        if (item.type === 'form' && item.formId) {
            e.preventDefault();
            // Don't fetch if already fetched
            if (!formData) {
                setIsLoadingForm(true);
                try {
                    const res = await fetch(`/api/forms?id=${item.formId}&siteId=${siteId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setFormData(data);
                        setIsModalOpen(true);
                    } else {
                        console.error('Failed to load form');
                        // Optional: Show toast error
                    }
                } catch (error) {
                    console.error('Error loading form:', error);
                }
                setIsLoadingForm(false);
            } else {
                setIsModalOpen(true);
            }
        }
    };

    const Wrapper = item.type === 'form' ? 'button' : 'a';
    /* ... existing props ... */
    const wrapperProps: any = item.type === 'form' ? {
        onClick: handleClick,
        type: 'button'
    } : {
        href: getTenantAwareUrl(item.url),
        target: item.openInNewTab ? '_blank' : undefined,
        rel: item.openInNewTab ? 'noopener noreferrer' : undefined,
        onClick: handleClick
    };

    const context = React.useContext(TemplateContext);

    // Fallback if context is missing (prevents crash)
    const template = context?.template || { config: { cardVariant: 'default' } as any };
    // We only need specific config values, but if theme is missing, we might have issues later in code.
    // Let's rely on loose typing or provide a safer fallback if possible.

    if (!context) {
        // console.warn('LinkCard rendered outside TemplateProvider');
    }




    // We already derived isClean above.
    // Logic: 
    // If isClean: use the clean/outlined style (rounded-xl, thin border).
    // If !isClean (Brutalist): use the bold style (rounded-2xl, thick border).

    // Mapping existing toggle: 'isOutlined' variable in JSX controlled the clean look.
    // So we map 'isClean' to that toggle for the JSX below.
    const renderClean = !isGlass && (isClean || isOutlined);

    return (
        <>
            <Wrapper
                {...wrapperProps}
                className={`
                    group flex items-center p-4 w-full relative overflow-hidden transition-all duration-200 hover:opacity-80
                    ${isGlass
                        ? 'bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20'
                        : 'bg-white border border-gray-200'
                    }
                    ${item.highlight ? 'ring-2 ring-[var(--theme-primary)]/40' : ''}
                `}
                style={{ borderRadius: 'var(--theme-radius)', boxShadow: 'var(--theme-card-shadow)' }}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div
                        className={`p-2 shrink-0 ${
                            isHighlight
                                ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)]/40 text-[var(--theme-primary)]'
                                : isGlass
                                ? 'bg-white/10 border-white/20 text-white/80'
                                : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                        style={{ borderRadius: '9999px' }}
                    >
                        <Icon size={24} strokeWidth={2} />
                    </div>
                    <div className="text-left">
                        <h3 className={`font-bold text-base leading-tight ${isGlass ? 'text-white' : 'text-gray-900'}`}>
                            {item.title}
                        </h3>
                        {item.subtitle && (
                            <p className={`text-sm font-medium ${isHighlight ? 'text-[var(--theme-primary)]' : isGlass ? 'text-white/60' : 'text-gray-500'}`}>
                                {item.subtitle}
                            </p>
                        )}
                    </div>
                </div>

                <div className={`transform transition-transform duration-200 group-hover:translate-x-1 ${isGlass ? 'text-white/40' : 'text-gray-400'}`}>
                    {isLoadingForm ? (
                        <div className="w-6 h-6 border-2 border-t-transparent border-[var(--theme-primary)] rounded-full animate-spin" />
                    ) : (
                        isHighlight ? <ArrowRight size={24} strokeWidth={2} /> : <ExternalLink size={24} strokeWidth={2} />
                    )}
                </div>
            </Wrapper>

            {isModalOpen && formData && (
                <FormModal
                    form={formData}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    siteId={effectiveSiteId}
                />
            )}
        </>
    );
};

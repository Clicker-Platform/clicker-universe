'use client';

import React from 'react';
import { LinkItem } from '@/data/mockData';
import { ArrowRight, ExternalLink, ShoppingBag } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ICON_MAP } from '@/data/icons';

import { FormModal } from '@/components/FormModal';
import { TemplateContext } from '@/components/TemplateProvider';

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
    const isOutlined = theme.cardVariant === 'outlined'; // Keep for specific variant logic if needed, but isClean dominates general layout

    // Helper: isBrutalist implies (!isClean)
    // Legacy mapping: isOutlined was used as a rough proxy for Clean/Sojourner. 
    // Now we strictly use isClean for the structure change.

    const { track } = useAnalytics();

    // Form Modal State
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [formData, setFormData] = React.useState<any>(null);
    const [isLoadingForm, setIsLoadingForm] = React.useState(false);

    // Construct tenant-aware URL
    const getTenantAwareUrl = (url: string): string => {
        // If URL is external (starts with http/https) or is a hash/anchor, return as-is
        if (url.startsWith('http') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
            return url;
        }

        // If internal relative URL and we have tenantSlug, prepend it
        if (tenantSlug && url.startsWith('/')) {
            return `/${tenantSlug}${url}`;
        }

        return url;
    };

    const handleClick = async (e: React.MouseEvent) => {
        track({ type: 'link_click', id: item.id });

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
    const renderClean = isClean || isOutlined;

    return (
        <>
            <Wrapper
                {...wrapperProps}
                className={`
                    group flex items-center p-4 w-full relative overflow-hidden
                    ${renderClean
                        ? 'bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-green/30 transition-all duration-200'
                        : 'rounded-2xl bg-white border-[3px] border-brand-dark shadow-sticker transition-all duration-200 hover:-translate-y-1 hover:shadow-sticker-hover active:translate-y-0 active:shadow-sticker'
                    }
                    ${item.highlight ? (renderClean ? 'ring-2 ring-brand-green/20' : 'ring-4 ring-brand-dark/20 animate-wiggle') : ''}
                `}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className={`
                        p-2 rounded-xl border-[2px] shrink-0
                        ${renderClean
                            ? (isHighlight ? 'bg-brand-green/10 border-brand-green text-brand-green' : 'bg-gray-50 border-gray-200 text-gray-600')
                            : (isHighlight ? 'bg-brand-green border-brand-green text-brand-dark' : 'bg-brand-green border-brand-dark text-brand-dark')
                        }
                    `}>
                        <Icon size={24} strokeWidth={renderClean ? 2 : 2.5} />
                    </div>
                    <div className="text-left">
                        <h3 className={`leading-tight ${renderClean ? 'font-bold text-gray-900 text-base' : 'font-extrabold text-lg'}`}>
                            {item.title}
                        </h3>
                        {item.subtitle && (
                            <p className={`text-sm ${renderClean ? 'font-medium text-gray-500' : 'font-bold'} ${isHighlight ? (renderClean ? 'text-brand-green' : 'text-brand-green/80') : 'text-brand-dark/60'}`}>
                                {item.subtitle}
                            </p>
                        )}
                    </div>
                </div>

                <div className={`
                    transform transition-transform duration-200 
                    group-hover:translate-x-1 ${renderClean ? 'text-gray-400' : ''}
                `}>
                    {isLoadingForm ? (
                        <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${renderClean ? 'border-brand-green' : 'border-brand-dark'}`}></div>
                    ) : (
                        isHighlight ? <ArrowRight size={24} strokeWidth={renderClean ? 2 : 3} /> : <ExternalLink size={24} strokeWidth={renderClean ? 2 : 3} />
                    )}
                </div>
            </Wrapper>

            {isModalOpen && formData && (
                <FormModal
                    form={formData}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    siteId={siteId}
                />
            )}
        </>
    );
};

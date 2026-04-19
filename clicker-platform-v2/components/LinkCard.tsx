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
    cardBgColor?: string;
    cardBorderColor?: string;
    cardFgColor?: string; // derived contrast color, passed from QuickActions
}

export const LinkCard: React.FC<LinkCardProps> = ({ item, siteId, tenantSlug, cardBgColor, cardBorderColor, cardFgColor }) => {
    const isHighlight = item.highlight;
    const Icon = item.iconName && ICON_MAP[item.iconName] ? ICON_MAP[item.iconName] : ShoppingBag;

    const { theme } = React.useContext(TemplateContext) || { theme: { cardStyle: 'brutalist' } as any };
    const isGlass = theme.cardStyle === 'glass';

    const { track } = useAnalytics();
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [formData, setFormData] = React.useState<any>(null);
    const [isLoadingForm, setIsLoadingForm] = React.useState(false);

    const { siteId: contextSiteId, tenantSlug: contextTenantSlug, isSubdomain } = useSite();
    const effectiveSiteId = siteId || contextSiteId;
    const effectiveTenantSlug = tenantSlug || contextTenantSlug || '';

    const getTenantAwareUrl = (url: string): string =>
        resolveNavHref(url, effectiveTenantSlug, isSubdomain);

    // Resolved colors: block override → theme token → glass fallback
    const bgColor = isGlass ? 'rgba(0,0,0,0.2)' : (cardBgColor || theme.colors?.surface || '#ffffff');
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (cardBorderColor || theme.colors?.border || '#e5e7eb');
    const fgColor = isGlass ? 'rgba(255,255,255,0.95)' : (cardFgColor || theme.colors?.foreground);
    const mutedColor = isGlass ? 'rgba(255,255,255,0.4)' : (cardFgColor ? `${cardFgColor}99` : (theme.colors?.textMuted || '#9ca3af'));

    const handleClick = async (e: React.MouseEvent) => {
        track({ type: 'link_click', id: item.id, siteId: effectiveSiteId });
        if (item.type === 'form' && item.formId) {
            e.preventDefault();
            if (!formData) {
                setIsLoadingForm(true);
                try {
                    const res = await fetch(`/api/forms?id=${item.formId}&siteId=${siteId}`);
                    if (res.ok) { setFormData(await res.json()); setIsModalOpen(true); }
                    else console.error('Failed to load form');
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
    const wrapperProps: any = item.type === 'form'
        ? { onClick: handleClick, type: 'button' }
        : { href: getTenantAwareUrl(item.url), target: item.openInNewTab ? '_blank' : undefined, rel: item.openInNewTab ? 'noopener noreferrer' : undefined, onClick: handleClick };

    return (
        <>
            <Wrapper
                {...wrapperProps}
                className={`group flex items-center p-4 w-full relative overflow-hidden transition-all duration-200 hover:opacity-80 ${item.highlight ? 'ring-2 ring-[var(--theme-primary)]/40' : ''}`}
                style={{
                    borderRadius: 'var(--theme-radius)',
                    boxShadow: 'var(--theme-card-shadow)',
                    background: bgColor,
                    backdropFilter: isGlass ? 'blur(12px)' : undefined,
                    border: `1px solid ${borderColor}`,
                }}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div
                        className="p-2 shrink-0"
                        style={{
                            borderRadius: '9999px',
                            backgroundColor: isHighlight ? `${theme.colors?.primary}20` : isGlass ? 'rgba(255,255,255,0.10)' : `${fgColor}15`,
                            color: isHighlight ? theme.colors?.primary : fgColor,
                        }}
                    >
                        <Icon size={24} strokeWidth={2} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-base leading-tight" style={{ color: fgColor }}>
                            {item.title}
                        </h3>
                        {item.subtitle && (
                            <p className="text-sm font-medium" style={{ color: isHighlight ? theme.colors?.primary : mutedColor }}>
                                {item.subtitle}
                            </p>
                        )}
                    </div>
                </div>

                <div className="transform transition-transform duration-200 group-hover:translate-x-1" style={{ color: mutedColor }}>
                    {isLoadingForm
                        ? <div className="w-6 h-6 border-2 border-t-transparent border-[var(--theme-primary)] rounded-full animate-spin" />
                        : isHighlight ? <ArrowRight size={24} strokeWidth={2} /> : <ExternalLink size={24} strokeWidth={2} />
                    }
                </div>
            </Wrapper>

            {isModalOpen && formData && (
                <FormModal form={formData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} siteId={effectiveSiteId} />
            )}
        </>
    );
};

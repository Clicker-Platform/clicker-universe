'use client';

import React from 'react';
import { LinkItem, BusinessContact, LinkSettings } from '@/data/mockData';
import { LinkCard } from '@/components/blocks/public/LinkCard';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { FormModal } from '@/components/FormModal';
import { ICON_MAP } from '@/data/icons';
import { ShoppingBag } from 'lucide-react';
import { getWhatsappUrl } from '@/components/common/WhatsappButton';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { getContrastColor } from '@/lib/utils/color';
import { getHeadingColor, getMutedColor, getLabelColor, hexWithOpacity } from './cardStyles';
import { H3, H4 } from './typography';

interface QuickActionsProps {
    links: LinkItem[];
    contact?: BusinessContact;
    settings?: LinkSettings;
    siteId?: string;
    tenantSlug?: string;
    blockData?: { hiddenLinkIds?: string[]; layout?: 'list' | 'grid'; cardBgColor?: string; cardBorderColor?: string; title?: string };
    defaultLayout?: 'list' | 'grid';
}

export const DefaultQuickActionsBlock: React.FC<QuickActionsProps> = ({
    links, contact, settings, siteId, tenantSlug, blockData, defaultLayout = 'list'
}) => {
    const { theme } = useTemplate();
    const { siteId: contextSiteId, tenantSlug: contextTenantSlug, isSubdomain } = useSite();
    const effectiveSiteId = siteId || contextSiteId;
    const effectiveTenantSlug = tenantSlug || contextTenantSlug || '';

    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [formData, setFormData] = React.useState<any>(null);
    const [isLoadingForm, setIsLoadingForm] = React.useState(false);

    const isGlass = theme.cardStyle === 'glass';
    const sectionTitle = blockData?.title || settings?.sectionTitle || 'Quick Actions';
    const showOnHome = settings?.showOnHome !== false;
    const hiddenLinkIds: string[] = blockData?.hiddenLinkIds || [];
    const layout: 'list' | 'grid' = blockData?.layout || defaultLayout;

    // Block-level color overrides
    const cardBgColor = blockData?.cardBgColor;
    const cardBorderColor = blockData?.cardBorderColor;
    // Derive contrast foreground from bg override; fall back to theme foreground
    const cardFgColor = cardBgColor
        ? getContrastColor(cardBgColor, '#ffffff', theme.colors.foreground || '#1a1a1a')
        : undefined;

    const processedLinks = links
        .filter(link => !link.hideOnHome && !hiddenLinkIds.includes(link.id))
        .map(link => {
            if (contact?.whatsapp && link.url === '#' && (link.title.toLowerCase().includes('whatsapp') || link.title.toLowerCase().includes('order'))) {
                return { ...link, url: getWhatsappUrl(contact.whatsapp, "Hi! I'd like to reach out...") };
            }
            return link;
        });

    const getTenantAwareUrl = (url: string): string =>
        resolveNavHref(url, effectiveTenantSlug, isSubdomain);

    const handleClick = async (e: React.MouseEvent, item: LinkItem) => {
        if (item.type === 'form' && item.formId) {
            e.preventDefault();
            if (!formData) {
                setIsLoadingForm(true);
                try {
                    const res = await fetch(`/api/forms?id=${item.formId}&siteId=${effectiveSiteId}`);
                    if (res.ok) { setFormData(await res.json()); setIsModalOpen(true); }
                } catch (err) { console.error('Error loading form:', err); }
                setIsLoadingForm(false);
            } else {
                setIsModalOpen(true);
            }
        }
    };

    // Card surface still needs local resolution because block-level overrides
    // (cardBgColor / cardBorderColor) take precedence over theme tokens.
    const resolvedBg = isGlass
        ? `${theme.colors.surfaceElevated || theme.colors.surface}99`
        : (cardBgColor || theme.colors.surface || '#ffffff');
    const resolvedBorder = isGlass
        ? 'rgba(255,255,255,0.1)'
        : (cardBorderColor || theme.colors.border || '#e5e7eb');

    // Foreground colors: if the user overrode cardBgColor, derive contrast.
    // Otherwise route through the standard helpers.
    const resolvedFg = cardFgColor ?? getHeadingColor(theme.cardStyle, theme);
    const resolvedMuted = cardFgColor
        ? hexWithOpacity(cardFgColor, 0.6)
        : getMutedColor(theme.cardStyle, theme);

    const cardStyle: React.CSSProperties = {
        borderRadius: 'var(--theme-radius)',
        boxShadow: 'var(--theme-card-shadow)',
        background: resolvedBg,
        backdropFilter: isGlass ? 'blur(12px)' : undefined,
        border: `1px solid ${resolvedBorder}`,
    };

    const iconStyle = (isHighlight: boolean): React.CSSProperties => ({
        borderRadius: '9999px',
        backgroundColor: isHighlight
            ? `${theme.colors.primary}20`
            : isGlass ? 'rgba(255,255,255,0.10)' : `${resolvedFg}15`,
        color: isHighlight ? theme.colors.primary : resolvedFg,
    });

    return (
        <section className="w-full space-y-4">
            {showOnHome && !theme.custom?.hideQuickActionsTitle && (
                <h2
                    className={H4}
                    style={{ color: getLabelColor(theme.cardStyle, theme) }}
                >
                    {sectionTitle}
                </h2>
            )}

            {layout === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {processedLinks.map(link => {
                        const Icon = link.iconName && ICON_MAP[link.iconName] ? ICON_MAP[link.iconName] : ShoppingBag;
                        const Wrapper = link.type === 'form' ? 'button' : 'a';
                        const wrapperProps: any = link.type === 'form'
                            ? { onClick: (e: any) => handleClick(e, link), type: 'button' }
                            : { href: getTenantAwareUrl(link.url), target: link.openInNewTab ? '_blank' : undefined, rel: link.openInNewTab ? 'noopener noreferrer' : undefined, onClick: (e: any) => handleClick(e, link) };

                        return (
                            <Wrapper
                                key={link.id}
                                {...wrapperProps}
                                className="group relative flex flex-col items-center justify-center gap-3 p-4 text-center w-full hover:opacity-80 transition-opacity"
                                style={cardStyle}
                            >
                                <div className="p-2.5 flex items-center justify-center" style={iconStyle(!!link.highlight)}>
                                    <Icon size={22} strokeWidth={2} />
                                </div>
                                <span className={H3} style={{ color: resolvedFg }}>
                                    {link.title}
                                </span>
                                {link.subtitle && (
                                    <span className="text-sm font-normal leading-normal" style={{ color: resolvedMuted }}>
                                        {link.subtitle}
                                    </span>
                                )}
                                {isLoadingForm && link.type === 'form' && (
                                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: `${theme.colors.background}80`, borderRadius: 'var(--theme-radius)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme.colors.primary }} />
                                    </div>
                                )}
                            </Wrapper>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-3">
                    {processedLinks.map(link => (
                        <LinkCard
                            key={link.id}
                            item={link}
                            siteId={siteId}
                            tenantSlug={tenantSlug}
                            cardBgColor={cardBgColor}
                            cardBorderColor={cardBorderColor}
                            cardFgColor={cardFgColor}
                        />
                    ))}
                </div>
            )}

            {isModalOpen && formData && (
                <FormModal form={formData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} siteId={effectiveSiteId} />
            )}
        </section>
    );
};

export { DefaultQuickActionsBlock as QuickActions };

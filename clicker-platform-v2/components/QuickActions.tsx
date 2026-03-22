'use client';

import React from 'react';
import { LinkItem, BusinessContact, LinkSettings } from '@/data/mockData';
import { LinkCard } from './LinkCard';
import { useTemplate } from '@/components/TemplateProvider';
import { ICON_MAP } from '@/data/icons';
import { ShoppingBag } from 'lucide-react';
import { getWhatsappUrl } from '@/components/common/WhatsappButton';

interface QuickActionsProps {
    links: LinkItem[];
    contact?: BusinessContact;
    settings?: LinkSettings;
    siteId?: string;
    tenantSlug?: string;
    blockData?: { hiddenLinkIds?: string[]; layout?: 'list' | 'grid' };
}

export const QuickActions: React.FC<QuickActionsProps> = ({ links, contact, settings, siteId, tenantSlug, blockData }) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    const sectionTitle = settings?.sectionTitle || "Quick Actions";
    const showOnHome = settings?.showOnHome !== false;
    const hiddenLinkIds: string[] = blockData?.hiddenLinkIds || [];
    const layout: 'list' | 'grid' = blockData?.layout || 'list';

    const processedLinks = links
        .filter(link => !link.hideOnHome && !hiddenLinkIds.includes(link.id))
        .map(link => {
            if (contact?.whatsapp && link.url === '#' && (link.title.toLowerCase().includes('whatsapp') || link.title.toLowerCase().includes('order'))) {
                return { ...link, url: getWhatsappUrl(contact.whatsapp, "Hi SunnySide! I'd like to order...") };
            }
            return link;
        });

    const containerStyle = isClean
        ? {}
        : { borderColor: theme.colors.foreground, boxShadow: `4px 4px 0px ${theme.colors.foreground}` };

    const textStyle = { color: theme.colors.foreground };

    return (
        <div className="space-y-4">
            {/* Section Label */}
            {showOnHome && !theme.custom?.hideQuickActionsTitle && (
                <div className="flex justify-center mb-6">
                    <div
                        className={`px-8 py-3 rounded-full transition-transform ${
                            isClean
                                ? 'bg-white shadow-sm border border-gray-200'
                                : 'bg-brand-white border-[3px] rotate-1 hover:rotate-0'
                        }`}
                        style={!isClean ? containerStyle : {}}
                    >
                        <h2
                            className={`font-extrabold uppercase tracking-wider text-base ${isClean ? 'text-gray-600' : ''}`}
                            style={!isClean ? textStyle : {}}
                        >
                            {sectionTitle}
                        </h2>
                    </div>
                </div>
            )}

            {layout === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {processedLinks.map(link => {
                        const Icon = link.iconName && ICON_MAP[link.iconName] ? ICON_MAP[link.iconName] : ShoppingBag;
                        const isHighlight = link.highlight;
                        return (
                            <a
                                key={link.id}
                                href={link.url}
                                target={link.openInNewTab ? '_blank' : undefined}
                                rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl text-center transition-all ${
                                    isGlass
                                        ? 'bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/10'
                                        : isClean
                                        ? 'bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-green/30'
                                        : 'bg-white border-[3px] border-brand-dark shadow-sticker hover:-translate-y-1 hover:shadow-sticker-hover'
                                }`}
                            >
                                <div className={`p-2.5 rounded-xl border-2 ${
                                    isGlass
                                        ? (isHighlight ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)]/40 text-[var(--theme-primary)]' : 'bg-white/10 border-white/20 text-white/80')
                                        : isClean
                                        ? (isHighlight ? 'bg-brand-green/10 border-brand-green text-brand-green' : 'bg-gray-50 border-gray-200 text-gray-600')
                                        : (isHighlight ? 'bg-brand-green border-brand-green text-brand-dark' : 'bg-brand-green border-brand-dark text-brand-dark')
                                }`}>
                                    <Icon size={22} strokeWidth={2} />
                                </div>
                                <span className={`text-sm font-bold leading-tight ${
                                    isGlass ? 'text-white' : isClean ? 'text-gray-900' : 'text-brand-dark'
                                }`}>
                                    {link.title}
                                </span>
                            </a>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-4">
                    {processedLinks.map(link => (
                        <LinkCard key={link.id} item={link} siteId={siteId} tenantSlug={tenantSlug} />
                    ))}
                </div>
            )}
        </div>
    );
};

'use client';

import React from 'react';
import { LinkItem, BusinessContact, LinkSettings } from '@/data/mockData';
import { LinkCard } from './LinkCard';
import { useTemplate } from '@/components/TemplateProvider';

interface QuickActionsProps {
    links: LinkItem[];
    contact?: BusinessContact;
    settings?: LinkSettings;
    siteId?: string;
    tenantSlug?: string;
}

import { getWhatsappUrl } from '@/components/common/WhatsappButton';

export const QuickActions: React.FC<QuickActionsProps> = ({ links, contact, settings, siteId, tenantSlug }) => {
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';

    // Default settings if not provided
    const sectionTitle = settings?.sectionTitle || "Quick Actions";
    const showOnHome = settings?.showOnHome !== false; // Default true

    const processedLinks = links
        .filter(link => !link.hideOnHome)
        .map(link => {
            if (contact?.whatsapp && link.url === '#' && (link.title.toLowerCase().includes('whatsapp') || link.title.toLowerCase().includes('order'))) {
                return {
                    ...link,
                    url: getWhatsappUrl(contact.whatsapp, "Hi SunnySide! I'd like to order...")
                };
            }
            return link;
        });

    const containerStyle = isClean
        ? {}
        : {
            borderColor: theme.colors.foreground,
            boxShadow: `4px 4px 0px ${theme.colors.foreground}`,
        };

    const textStyle = {
        color: theme.colors.foreground
    };

    return (
        <div className="space-y-4">
            {/* Section Label */}
            {showOnHome && !theme.custom?.hideQuickActionsTitle && (
                <div className="flex justify-center mb-6">
                    <div
                        className={`
                            px-8 py-3 rounded-full transition-transform
                            ${isClean
                                ? 'bg-white shadow-sm border border-gray-200'
                                : 'bg-brand-white border-[3px] rotate-1 hover:rotate-0'
                            }
                        `}
                        style={!isClean ? containerStyle : {}}
                    >
                        <h2
                            className={`
                                font-extrabold uppercase tracking-wider text-base
                                ${isClean ? 'text-gray-600' : ''}
                            `}
                            style={!isClean ? textStyle : {}}
                        >
                            {sectionTitle}
                        </h2>
                    </div>
                </div>
            )}

            {processedLinks.map((link) => (
                <LinkCard key={link.id} item={link} siteId={siteId} tenantSlug={tenantSlug} />
            ))}
        </div>
    );
};

'use client';

import React from 'react';
import {
    profile,
    links,
    featuredProduct,
    products,
    socialLinks,
    initialBusinessHours,
    initialBusinessContact,
    defaultBusinessSchedule,
    SiteSettings
} from '@/data/mockData';
import { TemplateDocument } from '@/lib/templates/types';
import { PublicPageRenderer } from '@/components/PublicPageRenderer';

interface ThemeMockupProps {
    template: TemplateDocument | any;
    settings?: Partial<SiteSettings>;
    isMini?: boolean;
    realData?: any;
    siteId?: string;
}

export const ThemeMockup: React.FC<ThemeMockupProps> = ({ template, settings: customSettings, isMini = false, realData, siteId }) => {
    const config = template.config;
    if (!config) return null;

    // Combine base settings with custom overrides
    const displaySettings: SiteSettings = {
        title: customSettings?.title || template.name,
        description: customSettings?.description || 'Your tagline here',
        themeColor: customSettings?.themeColor || config.colors.primary,
        accentColor: customSettings?.accentColor || config.colors.accent,
        fontFamily: customSettings?.fontFamily || (template.id === 'shuvo' ? 'Playfair Display' : 'Plus Jakarta Sans'),
        borderRadius: customSettings?.borderRadius || 'large',
        faviconUrl: customSettings?.faviconUrl || '',
        ogImageUrl: customSettings?.ogImageUrl || '',
        templateId: template.id as any,
        backgroundImageUrl: customSettings?.backgroundImageUrl || '',
        footerText: customSettings?.footerText || '© 2024 Your Company',
        homeBlockOrder: customSettings?.homeBlockOrder || ['quick_actions', 'branches', 'featured', 'gallery', 'hours'],
        hiddenBlockIds: customSettings?.hiddenBlockIds || [],
        galleryTitle: customSettings?.galleryTitle || 'Gallery',
        navigation: customSettings?.navigation || { topNav: [], bottomNav: [] }
    };

    const mockDataPayload = {
        profile: {
            ...profile,
            name: displaySettings.title,
            description: displaySettings.description,
            avatarUrl: displaySettings.faviconUrl || profile.avatarUrl
        },
        links: (realData?.links?.length > 0 ? realData.links : links),
        featuredProduct: (() => {
            if (realData?.featuredProduct) {
                const productId = realData.featuredProduct.productId || realData.featuredProduct.originalId;
                const p = realData.products?.find((prod: any) => prod.id === productId);
                if (p) {
                    return {
                        ...p,
                        name: p.title || p.name,
                        imageUrl: p.imageUrl || p.image || (p.images && p.images[0])
                    };
                }
            }
            return featuredProduct;
        })(),
        products: (realData?.products?.length > 0 ? realData.products.map((p: any) => ({
            ...p,
            name: p.title || p.name,
            imageUrl: p.imageUrl || p.image || (p.images && p.images[0])
        })) : products),
        socialLinks: realData?.contact?.socialLinks || socialLinks,
        templateId: template.id as any,
        businessHours: realData?.contact?.businessHours || initialBusinessHours,
        footerText: displaySettings.footerText || '',
        hideFooterContact: displaySettings.hideFooterContact ?? true,
        showHeaderAddress: displaySettings.showHeaderAddress || false,
        contact: realData?.contact || initialBusinessContact,
        branches: (realData?.branches?.length > 0 ? realData.branches : []),
        homeBlockOrder: displaySettings.homeBlockOrder || [],
        themeColor: displaySettings.themeColor,
        accentColor: displaySettings.accentColor,
        hiddenBlockIds: displaySettings.hiddenBlockIds,
        borderRadius: displaySettings.borderRadius,
        linkSettings: realData?.linkSettings || {},
        productSettings: realData?.productSettings || {},
        businessSchedule: realData?.contact?.businessSchedule || defaultBusinessSchedule
    };

    return (
        <div 
            className={`
                w-full overflow-hidden transition-all duration-300 relative
                ${isMini ? 'h-full flex items-center justify-center' : 'h-[800px] border'}
            `}
            style={{
                borderColor: isMini ? 'transparent' : displaySettings.accentColor,
                borderRadius: isMini ? '0px' : '1.5rem',
                backgroundColor: config.colors.background || displaySettings.themeColor,
            }}
        >
            {/* The wrapper creates a CSS stacking context and transform basis for fixed elements */}
            <div 
                className="absolute origin-top transform-gpu"
                style={{
                    width: '390px', // Standard mobile width
                    top: 0,
                    left: '50%',
                    transform: `translateX(-50%) ${isMini ? 'scale(0.35)' : 'scale(0.85)'}`,
                    height: isMini ? 'calc(100% / 0.35)' : 'calc(100% / 0.85)',
                    // By defining transform on this container, fixed children inside PublicPageRenderer
                    // will position relative to this container instead of the viewport.
                }}
            >
                <div 
                    className="w-full h-full overflow-y-auto no-scrollbar pointer-events-none"
                    style={{
                        pointerEvents: isMini ? 'none' : 'auto'
                    }}
                >
                    <PublicPageRenderer data={mockDataPayload} forceMobile={true} siteId={siteId || 'preview'} />
                </div>
             </div>
        </div>
    );
};

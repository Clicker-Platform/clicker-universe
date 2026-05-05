'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ClassicProfileHeader } from "@/components/headers/ClassicProfileHeader";
import { DefaultFeaturedProductBlock } from "@/components/blocks/public/DefaultFeaturedProductBlock";
import { DefaultProductGalleryBlock as ProductGallery } from "@/components/blocks/public/DefaultProductGalleryBlock";
import { Footer } from "@/components/Footer";
import { DefaultOperatingHoursBlock as OperatingHours } from "@/components/blocks/public/DefaultOperatingHoursBlock";
import { BackgroundDecorations } from "@/components/BackgroundDecorations";
import { DefaultQuickActionsBlock as QuickActions } from "@/components/blocks/public/DefaultQuickActionsBlock";
import { DefaultBranchesBlock as BranchesList } from "@/components/blocks/public/DefaultBranchesBlock";
import { BusinessProfile, LinkItem, Product, SocialLinkItem, BusinessHours, BusinessContact, Branch } from "@/data/mockData";
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';
import { DaySchedule } from "@/lib/core/types";
import { TemplateId } from '@/lib/templates/types';
import { getTemplate } from '@/lib/templates/registry'; // Use registry which includes components
import { getBlockSpan } from '@/lib/templates/layoutUtils';
import { TemplateProvider } from '@/components/TemplateProvider';
import { ModernProfileHeader } from '@/components/headers/ModernProfileHeader';
import { SharedPageLayout } from '@/components/layout/SharedPageLayout';

// No local selector, we use the registry logic directly or mapped
// Since registry.ts has getTemplate returning components, we should use that if possible.
// However, PublicPageRenderer is a Client Component.
// Registry imports Server Components? No, headers are 'use client'.
// Let's use the explicit map here to be safe but cleaner.

function HeaderSelector({ templateId, props }: { templateId: string, props: any }) {
    // This looks redundant if we can use dynamic Registry.
    // Ideally: const Component = registry[layoutStyle].Header;
    // But let's look at the mapping logic I updated in task 232.
    // We already identified Modern use ModernProfileHeader.
    // Classic uses ClassicProfileHeader.

    // STRICT FIX: logic should rely on definition if possible? No, strictly registry mapping.
    // Let's keep HeaderSelector but make it cleaner or just rely on the fallback.
    // Actually, the user wants "perfect". Perfect means no ad-hoc switches.
    const template = getTemplate(templateId);
    const HeaderComponent = template.components?.Header || ClassicProfileHeader;
    return <HeaderComponent {...props} />;
}

export interface PublicPageProps {
    data: {
        profile: BusinessProfile | null;
        links: LinkItem[];
        featuredProduct: Product | null;
        products: Product[];
        socialLinks: SocialLinkItem[];
        templateId: TemplateId;
        businessHours: BusinessHours;
        footerText: string;
        hideFooterContact: boolean;
        showHeaderAddress: boolean;
        contact: BusinessContact;
        branches: Branch[];
        homeBlockOrder: string[];
        themeColor?: string;
        accentColor?: string;
        backgroundColor?: string;
        surfaceColor?: string;
        hiddenBlockIds?: string[];
        galleryTitle?: string;
        borderRadius?: 'small' | 'medium' | 'large' | 'none' | 'custom';
        linkSettings?: any;
        productSettings?: any;
        homepageSlug?: string;
        businessSchedule?: DaySchedule[];
    };
    forceMobile?: boolean;
    siteId?: string;
}

export function PublicPageRenderer({ data, forceMobile = false, siteId }: PublicPageProps) {
    const {
        profile,
        links,
        featuredProduct,
        products,
        socialLinks,
        templateId,
        businessHours,
        footerText,
        contact,
        branches,
        homeBlockOrder,
        showHeaderAddress,
        themeColor,
        hiddenBlockIds,
        borderRadius,
        linkSettings,
        productSettings
    } = data;

    // Use getTemplate to get both config and components
    const template = getTemplate(templateId || 'classic');
    const activeTemplate = template; // Alias for compatibility with existing code if needed, or just use template


    // Map border radius to CSS values
    const getRadiusValue = (size: 'small' | 'medium' | 'large' | 'none' | 'custom' = 'large') => {
        switch (size) {
            case 'small': return '12px'; // rounded-xl
            case 'medium': return '16px'; // rounded-2xl
            case 'large': return '24px'; // rounded-3xl
            default: return '24px';
        }
    };

    const radiusValue = getRadiusValue(borderRadius);



    // Isolation Logic:
    // Isolation Logic:
    // Others (Classic/Modern): Use the User's Custom Theme Color (or template default).
    // Isolation Logic:
    // Respect template configuration for theme overrides
    const pageBackgroundColor = activeTemplate.config.allowThemeColorOverride === false
        ? activeTemplate.config.colors.background
        : (themeColor || activeTemplate.config.colors.background);

    if (!profile) return <div className="text-center p-10 font-bold text-red-500">Profile data not found. Please set up the 'content/profile' document in Firestore.</div>;

    // suppressHydrationWarning here is the key to preventing crashes on dynamic attributes
    // suppressHydrationWarning here is the key to preventing crashes on dynamic attributes
    return (
        <SharedPageLayout
            templateId={templateId || 'classic'}
            data={data}
            forceMobile={forceMobile}
            siteId={siteId || 'preview'}
        >
            <PublicContentContent data={data} />
        </SharedPageLayout>
    );
}

const HeroBlock = dynamic(() => import('@/components/blocks/public/DefaultHeroBlock').then(mod => mod.DefaultHeroBlock));

// Renamed from PublicContent to PublicContentContent to avoid name clash or just inline it.
// Actually, extracting the block rendering logic is cleaner.
function PublicContentContent({ data }: { data: any }) {
    const {
        profile,
        links,
        featuredProduct,
        products,
        contact,
        branches,
        homeBlockOrder,
        hiddenBlockIds,
        linkSettings,
        businessHours,
        businessSchedule,
        footerText,
        socialLinks,
        templateId
    } = data;

    const template = getTemplate(templateId || 'classic');

    return (
        <div id="content-wrapper" className="w-full relative z-10 flex flex-col gap-4">
            {/* Dynamic Block Rendering */}
            {(homeBlockOrder || ['quick_actions', 'branches', 'featured', 'gallery', 'hours'])
                .filter((blockId: string) => !(hiddenBlockIds || []).includes(blockId)) // Filter out hidden blocks
                .map((blockId: string) => {
                    switch (blockId) {
                        case 'hero':
                            const HeroComponent = template.components?.Blocks?.Hero || HeroBlock;
                            return <HeroComponent key={blockId} profile={profile} theme={template.config} />;
                        case 'quick_actions':
                            const QuickActionsComponent = template.components?.Blocks?.QuickActions || QuickActions;
                            return <QuickActionsComponent key={blockId} links={links} contact={contact} settings={linkSettings} />;
                        case 'branches':
                            return <BranchesList key={blockId} contact={contact} branches={branches} />;
                        case 'featured':
                            if (!featuredProduct) return null;
                            const featuredSettings = data.productSettings || {};
                            return (
                                <DefaultFeaturedProductBlock
                                    key={blockId}
                                    product={featuredProduct}
                                    badgeText={featuredSettings.featuredTitle || "Star Pick"}
                                    showBadge={featuredSettings.showFeaturedTitle !== false}
                                    buttonText={featuredSettings.featuredBtnText || "Order This Now"}
                                    phoneNumber={contact.whatsapp}
                                    whatsappSettings={{
                                        label: featuredSettings.whatsappBtnLabel,
                                        messageTemplate: featuredSettings.whatsappMessageTemplate,
                                        bgColor: featuredSettings.whatsappBtnColor,
                                        textColor: featuredSettings.whatsappBtnTextColor
                                    }}
                                />
                            );
                        case 'gallery':
                            const prodSettings = data.productSettings || { galleryTitle: "More Treats", showSectionTitle: true, itemsToShow: 6 };
                            const limit = prodSettings.itemsToShow || 6;
                            const itemsToShow = products.slice(0, limit);
                            const hasMore = products.length > limit;

                            return (
                                <ProductGallery
                                    key={blockId}
                                    products={itemsToShow}
                                    title={prodSettings.showSectionTitle ? (prodSettings.galleryTitle || "More Treats") : ""}
                                    viewAllHref={hasMore ? "/catalog" : undefined}
                                    phoneNumber={contact.whatsapp}
                                    whatsappSettings={{
                                        label: prodSettings.whatsappBtnLabel,
                                        messageTemplate: prodSettings.whatsappMessageTemplate,
                                        bgColor: prodSettings.whatsappBtnColor,
                                        textColor: prodSettings.whatsappBtnTextColor,
                                        ctaMode: prodSettings.ctaMode,
                                        ctaUrl: prodSettings.ctaUrl,
                                        ctaUrlLabel: prodSettings.ctaUrlLabel,
                                    }}
                                />
                            );
                        case 'hours':
                            const OperatingHoursComponent = template.components?.Blocks?.OperatingHours || OperatingHours;
                            return <OperatingHoursComponent key={blockId} data={businessHours} schedule={businessSchedule} />;
                        default:
                            return null;
                    }
                })
            }
        </div>
    );
}

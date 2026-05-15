'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { DefaultFeaturedProductBlock } from "@/components/blocks/public/DefaultFeaturedProductBlock";
import { DefaultProductGalleryBlock as ProductGallery } from "@/components/blocks/public/DefaultProductGalleryBlock";
import { DefaultOperatingHoursBlock as OperatingHours } from "@/components/blocks/public/DefaultOperatingHoursBlock";
import { DefaultQuickActionsBlock as QuickActions } from "@/components/blocks/public/DefaultQuickActionsBlock";
import { DefaultBranchesBlock as BranchesList } from "@/components/blocks/public/DefaultBranchesBlock";
import { BusinessProfile, LinkItem, Product, SocialLinkItem, BusinessHours, BusinessContact, Branch, LinkSettings, ProductSettings } from "@/data/mockData";
import { DaySchedule } from "@/lib/core/types";
import { TemplateId } from '@/lib/templates/types';
import { getTemplate } from '@/lib/templates/registry'; // Use registry which includes components
import { SharedPageLayout } from '@/components/layout/SharedPageLayout';


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
        linkSettings?: LinkSettings;
        productSettings?: ProductSettings;
        homepageSlug?: string;
        businessSchedule?: DaySchedule[];
    };
    forceMobile?: boolean;
    siteId?: string;
}

export function PublicPageRenderer({ data, forceMobile = false, siteId }: PublicPageProps) {
    const { profile, templateId } = data;

    if (!profile) return <div className="text-center p-10 font-bold text-red-500">Profile data not found. Please set up the &apos;content/profile&apos; document in Firestore.</div>;

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
function PublicContentContent({ data }: { data: PublicPageProps['data'] }) {
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
        templateId
    } = data;

    const template = getTemplate(templateId || 'classic');

    return (
        <div id="content-wrapper" className="w-full relative z-10 flex flex-col gap-4">
            {/* Dynamic Block Rendering */}
            {(homeBlockOrder || ['quick_actions', 'branches', 'featured', 'gallery', 'hours'])
                .filter((blockId: string) => !(hiddenBlockIds || []).includes(blockId)) // Filter out hidden blocks
                .map((blockId: string, index: number) => {
                    const isFirst = index === 0;
                    switch (blockId) {
                        case 'hero':
                            const HeroComponent = (template.components?.Blocks?.Hero || HeroBlock) as React.ElementType<Record<string, unknown>>;
                            return <HeroComponent key={blockId} profile={profile} theme={template.config as unknown as Record<string, unknown>} isFirst={isFirst} />;
                        case 'quick_actions':
                            const QuickActionsComponent = template.components?.Blocks?.QuickActions || QuickActions;
                            return <QuickActionsComponent key={blockId} links={links} contact={contact} settings={linkSettings} />;
                        case 'branches':
                            return <BranchesList key={blockId} contact={contact} branches={branches} />;
                        case 'featured':
                            if (!featuredProduct) return null;
                            const featuredSettings: Partial<ProductSettings> & { featuredTitle?: string; showFeaturedTitle?: boolean } = data.productSettings || {};
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
                            const OperatingHoursComponent = (template.components?.Blocks?.OperatingHours || OperatingHours) as React.ElementType<{ data: BusinessHours; schedule?: DaySchedule[] }>;
                            return <OperatingHoursComponent key={blockId} data={businessHours} schedule={businessSchedule} />;
                        default:
                            return null;
                    }
                })
            }
        </div>
    );
}

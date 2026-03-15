import { fetchPublicData, fetchPageBySlug } from "@/lib/fetchData";
import { headers } from "next/headers";
import { findModuleForRoute } from '@/lib/modules/registry';
import { ModuleLoader } from '@/components/modules/ModuleLoader';
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getTemplate } from '@/lib/templates/registry';
import { SharedPageLayout } from '@/components/layout/SharedPageLayout';
import { PixelTracker } from "@/components/PixelTracker";
import { generateSystemBlocks } from '@/lib/systemBlocks';
import { notFound } from 'next/navigation';

export const revalidate = 60; // ISR: revalidate every 60 seconds

interface TenantPageProps {
    params: Promise<{ tenant: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
    const { tenant } = await params;
    const { t } = await searchParams;

    // Use tenant from URL segment as siteId
    const siteId = tenant;
    console.log('[TenantPage] Tenant/SiteId:', siteId);

    // Also set from header if middleware provides it (for consistency)
    const headersList = await headers();
    const headerSiteId = headersList.get('x-site-id');
    console.log('[TenantPage] Header SiteId:', headerSiteId);

    // Module Routing Check
    const moduleMatch = await findModuleForRoute('/');
    if (moduleMatch) {
        return (
            <ModuleLoader
                componentKey={moduleMatch.route.componentKey}
                params={Promise.resolve({})}
                searchParams={searchParams}
            />
        );
    }

    // Fetch public data for this tenant
    const publicData = await fetchPublicData(siteId, { includeProducts: true });

    // Check if tenant exists (has profile)
    if (!publicData.profile) {
        notFound();
    }

    const { homepageSlug, homeBlockOrder, hiddenBlockIds } = publicData;
    const targetSlug = homepageSlug || 'home';
    const homePage = await fetchPageBySlug(siteId, targetSlug);

    const blocksToRender = (homePage && homePage.blocks && homePage.blocks.length > 0)
        ? homePage.blocks
        : generateSystemBlocks(homeBlockOrder || [], hiddenBlockIds || []);

    const {
        profile,
        socialLinks,
        templateId,
        footerText,
        contact,
        hideFooterContact,
        showHeaderAddress,
        themeColor,
        borderRadius,
        globalPixels,
        productSettings
    } = publicData;

    const effectivePixels = {
        facebookPixelId: homePage?.pixels?.facebookPixelId || globalPixels?.facebookPixelId,
        googleAnalyticsId: homePage?.pixels?.googleAnalyticsId || globalPixels?.googleAnalyticsId,
        tiktokPixelId: homePage?.pixels?.tiktokPixelId || globalPixels?.tiktokPixelId,
    };

    const overrideTemplate = typeof t === 'string' ? t : undefined;
    const safeTemplateId = overrideTemplate || templateId || 'classic';
    const template = getTemplate(safeTemplateId);

    const pageBackgroundColor = template.config.allowThemeColorOverride === false
        ? template.config.colors.background
        : (themeColor || template.config.colors.background);

    const getRadiusValue = (size: 'small' | 'medium' | 'large' = 'large') => {
        switch (size) {
            case 'small': return '12px';
            case 'medium': return '16px';
            case 'large': return '24px';
            default: return '24px';
        }
    };
    const radiusValue = getRadiusValue(borderRadius);

    const heroFirst = blocksToRender[0]?.type === 'hero';

    return (
        <SharedPageLayout
            templateId={safeTemplateId}
            data={publicData}
            siteId={siteId}
            isSubPage={false}
            heroFirst={heroFirst}
            pageOverrides={{
                borderRadius: borderRadius,
                themeColor: themeColor
            }}
        >
            <PixelTracker pixels={effectivePixels} />
            
            {blocksToRender && Array.isArray(blocksToRender) && blocksToRender.length > 0 ? (
                <div
                    className="grid gap-6"
                    style={{ gridTemplateColumns: '1fr' }}
                >
                    {blocksToRender.map(block => (
                        <div key={block.id}>
                            <BlockRenderer
                                block={block}
                                phoneNumber={contact?.whatsapp}
                                whatsappSettings={{
                                    label: productSettings?.whatsappBtnLabel,
                                    messageTemplate: productSettings?.whatsappMessageTemplate,
                                    bgColor: productSettings?.whatsappBtnColor,
                                    textColor: productSettings?.whatsappBtnTextColor
                                }}
                                siteId={siteId}
                                tenantSlug={siteId}
                                templateId={safeTemplateId}
                                links={publicData.links}
                                contact={contact}
                                branches={publicData.branches}
                                featuredProduct={publicData.featuredProduct}
                                products={publicData.products}
                                businessHours={publicData.businessHours}
                                businessSchedule={publicData.businessSchedule}
                                linkSettings={publicData.linkSettings}
                                productSettings={productSettings}
                                profile={profile}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <article
                    className={`
                        bg-theme-surface p-6 flex-1
                        ${template.config.cardVariant === 'outlined' ? 'border border-gray-200 shadow-sm' : 'shadow-xl border-[3px] border-theme-border'}
                    `}
                    style={{ borderRadius: 'var(--theme-radius)' }}
                >
                    {homePage?.title && (
                        <h1 className={`
                            text-3xl font-extrabold text-theme-foreground mb-6 border-b-2 border-theme-border/30 pb-4
                            ${template.config.fonts.heading.includes('Inter') ? 'tracking-normal' : ''}
                        `}>
                            {homePage.title}
                        </h1>
                    )}
                    {homePage?.content && (
                        <div
                            className="prose prose-stone max-w-none text-theme-foreground/80 font-medium"
                            dangerouslySetInnerHTML={{ __html: homePage.content }}
                        />
                    )}
                </article>
            )}
        </SharedPageLayout>
    );
}

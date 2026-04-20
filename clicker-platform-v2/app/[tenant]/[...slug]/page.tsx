import { fetchPageBySlug, fetchPublicData, fetchLightweightPublicData, hydratePageBlocks } from '@/lib/fetchData';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { SharedPageLayout } from '@/components/layout/SharedPageLayout';
import { getTemplate } from '@/lib/templates/registry';
import { findModuleForRoute } from '@/lib/modules/registry';
import { ModuleLoader } from '@/components/modules/ModuleLoader';
import { TemplateProvider } from '@/components/TemplateProvider';
import { getBlockSpan } from '@/lib/templates/layoutUtils';
import { headers } from 'next/headers';

type Props = {
    params: Promise<{ tenant: string; slug: string[] }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const revalidate = 60; // ISR: revalidate every 60 seconds

// Helper: Resolve path from slug array
const getPath = (slug: string[]) => `/${slug.join('/')}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { tenant, slug } = await params;
    const path = getPath(slug);
    const siteId = tenant;

    // 1. Check for Module
    const moduleMatch = await findModuleForRoute(path);
    if (moduleMatch) {
        const { profile } = await fetchPublicData(siteId, { includeProducts: false });
        const businessName = profile?.name || 'Clicker App';
        return {
            title: `${moduleMatch.module.displayName} | ${businessName}`,
        };
    }

    // 2. Fallback to CMS (Only for single segment)
    if (slug.length === 1) {
        const page = await fetchPageBySlug(siteId, slug[0]);
        const { globalSeo } = await fetchPublicData(siteId);

        if (page) {
            const title = page.seo?.title || globalSeo?.title || page.title;
            const description = page.seo?.description || globalSeo?.description;
            const image = page.seo?.image || globalSeo?.image;
            const noIndex = page.seo?.noIndex ?? false;

            return {
                title,
                description,
                openGraph: {
                    title,
                    description,
                    images: image ? [{ url: image }] : [],
                },
                robots: noIndex ? { index: false, follow: false } : undefined,
            };
        }
    }

    return {};
}

export default async function TenantCatchAllPage({ params, searchParams }: Props) {
    const { tenant, slug } = await params;
    const resolvedSearchParams = await searchParams;
    const { t } = resolvedSearchParams;
    const path = getPath(slug);
    const siteId = tenant;

    console.log('[TenantCatchAll] Tenant:', tenant, 'Path:', path);

    // ---------------------------------------------------------
    // 1. Module Routing
    // ---------------------------------------------------------
    const moduleMatch = await findModuleForRoute(path);

    if (moduleMatch) {
        // LCP Optimization: Fetch POS Settings on Server for OrderPage
        // This avoids the waterfall effect of Client Component -> useEffect -> Fetch
        let initialData = {};
        if (moduleMatch.route.componentKey === 'byod_pos:OrderPage') {
            try {
                // Dynamic import to avoid bundling POS logic in main bundle if not needed
                const { getPOSSettings } = await import('@/lib/modules/byod_pos/api');
                const settings = await getPOSSettings(siteId);
                initialData = { initialSettings: settings };
            } catch (e) {
                console.error("Failed to fetch POS settings on server", e);
            }
        }

        const modulePublicData = await fetchLightweightPublicData(siteId);
        const overrideTemplate = typeof t === 'string' ? t : undefined;
        const moduleTemplateId = overrideTemplate || modulePublicData.templateId || 'classic';

        return (
            <TemplateProvider templateId={moduleTemplateId}>
                <ModuleLoader
                    componentKey={moduleMatch.route.componentKey}
                    params={{ tenant, slug }}
                    searchParams={resolvedSearchParams}
                    siteId={siteId}
                    {...initialData}
                />
            </TemplateProvider>
        );
    }

    // ---------------------------------------------------------
    // 2. CMS Page Fallback
    // ---------------------------------------------------------
    if (slug.length > 1) {
        notFound();
    }

    const pageSlug = slug[0];
    const [page, publicData] = await Promise.all([
        fetchPageBySlug(siteId, pageSlug),
        fetchLightweightPublicData(siteId)
    ]);

    if (!page) {
        notFound();
    }

    // Hydrate system blocks if the custom page uses them
    const hydratedData = await hydratePageBlocks(siteId, page.blocks || []);

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
        linkSettings,
        productSettings,
        businessHours
    } = publicData;

    const effectivePixels = {
        facebookPixelId: page.pixels?.facebookPixelId || globalPixels?.facebookPixelId,
        googleAnalyticsId: page.pixels?.googleAnalyticsId || globalPixels?.googleAnalyticsId,
        tiktokPixelId: page.pixels?.tiktokPixelId || globalPixels?.tiktokPixelId,
    };

    const overrideTemplate = typeof t === 'string' ? t : undefined;
    const safeTemplateId = overrideTemplate || templateId || 'classic';
    const template = getTemplate(safeTemplateId);

    const heroFirst = (page.blocks?.[0]?.type === 'hero');

    const navSettings = (publicData.navigation ?? {}) as any;
    const initialNavData = {
        topNav: navSettings.topNav ?? [],
        topNavActions: navSettings.topNavActions ?? null,
        bottomNav: navSettings.bottomNav ?? [],
        fab: navSettings.fab ?? null,
        headerStyle: navSettings.headerStyle ?? {},
        bottomNavStyle: navSettings.bottomNavStyle ?? {},
    };

    return (
        <SharedPageLayout
            templateId={safeTemplateId}
            data={publicData}
            siteId={siteId}
            isSubPage={true}
            heroFirst={heroFirst}
            pageTitle={page.title}
            initialNavData={initialNavData}
            pageOverrides={{
                borderRadius: borderRadius,
                themeColor: themeColor,
                customConfig: page.templateConfig?.customConfig
            }}
        >
            {page.blocks && Array.isArray(page.blocks) && page.blocks.length > 0 ? (
                <div className="grid gap-[var(--grid-gap)] dynamic-grid">
                    {page.blocks.map(block => {
                        const isSingleCol = template.config.layout?.grid?.desktop === 1;
                        const spanClass = isSingleCol ? 'col-span-full' : getBlockSpan(block.type);

                        return (
                            <div key={block.id} className={`${spanClass} min-w-0`}>
                                <BlockRenderer
                                    block={block}
                                    phoneNumber={contact?.whatsapp}
                                    whatsappSettings={{
                                        label: hydratedData.productSettings?.whatsappBtnLabel || productSettings?.whatsappBtnLabel,
                                        messageTemplate: hydratedData.productSettings?.whatsappMessageTemplate || productSettings?.whatsappMessageTemplate,
                                        bgColor: hydratedData.productSettings?.whatsappBtnColor || productSettings?.whatsappBtnColor,
                                        textColor: hydratedData.productSettings?.whatsappBtnTextColor || productSettings?.whatsappBtnTextColor,
                                        ctaMode: hydratedData.productSettings?.ctaMode || productSettings?.ctaMode,
                                        ctaUrl: hydratedData.productSettings?.ctaUrl || productSettings?.ctaUrl,
                                        ctaUrlLabel: hydratedData.productSettings?.ctaUrlLabel || productSettings?.ctaUrlLabel,
                                    }}
                                    theme={template.config}
                                    siteId={siteId}
                                    templateId={safeTemplateId}
                                    links={hydratedData.links}
                                    products={hydratedData.products}
                                    featuredProduct={hydratedData.featuredProduct}
                                    branches={hydratedData.branches}
                                    linkSettings={hydratedData.linkSettings || linkSettings}
                                    profile={profile}
                                    productSettings={hydratedData.productSettings || productSettings}
                                    reservationServices={hydratedData.reservationServices}
                                    reservationStaff={hydratedData.reservationStaff}
                                    reservationSettings={hydratedData.reservationSettings}
                                    businessHours={businessHours}
                                    businessSchedule={page.templateConfig?.customConfig?.businessSchedule || publicData.businessSchedule || {}}
                                    contact={contact}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <article
                    className={`
                        bg-theme-surface p-6 flex-1
                        ${template.config.cardVariant === 'outlined' ? 'border border-gray-200 shadow-sm' : 'shadow-xl border-[3px] border-theme-border'}
                    `}
                    style={{ borderRadius: 'var(--theme-radius)' }}
                >
                    {page.title && (
                        <h1 className={`
                            text-3xl font-extrabold text-theme-foreground mb-6 border-b-2 border-theme-border/30 pb-4
                            ${template.config.fonts.heading.includes('Inter') ? 'tracking-normal' : ''}
                        `}>
                            {page.title}
                        </h1>
                    )}
                    {page.content && (
                        <div
                            className="prose prose-stone max-w-none text-theme-foreground/80 font-medium"
                            dangerouslySetInnerHTML={{ __html: page.content }}
                        />
                    )}
                </article>
            )}
        </SharedPageLayout>
    );
}

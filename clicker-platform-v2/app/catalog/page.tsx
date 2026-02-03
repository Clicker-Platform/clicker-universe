import { fetchPublicData } from '@/lib/fetchData';
import { headers } from 'next/headers';
import { ClassicProfileHeader } from "@/components/headers/ClassicProfileHeader";
import { Footer } from "@/components/Footer";
import { BackgroundDecorations } from "@/components/BackgroundDecorations";
import Link from 'next/link';
import { Home } from 'lucide-react';
import { TemplateProvider, DeepPartial } from '@/components/TemplateProvider';
import { getTemplate } from '@/lib/templates/registry';
import { CatalogClient } from "./CatalogClient";
import { ThemeConfig } from '@/lib/templates/types';

export const revalidate = 0;

export default async function CatalogPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    // Await searchParams before access
    const { t } = await searchParams;
    const headersList = await headers();
    const siteId = headersList.get('x-site-id') || 'default';

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
        products,
        accentColor // Ensure we pass this if needed or implicit via theme
    } = await fetchPublicData(siteId);

    // Resolve Template (Priority: URL Param > DB Setting > Default)
    const overrideTemplate = typeof t === 'string' ? t : undefined;
    const safeTemplateId = overrideTemplate || templateId || 'classic';
    const template = getTemplate(safeTemplateId);
    // Components from Registry
    const HeaderComponent = template.components?.Header || ClassicProfileHeader;
    const Background = template.components?.Background || BackgroundDecorations;

    // Isolation Logic (Same as UserPage)
    const pageBackgroundColor = template.config.allowThemeColorOverride === false
        ? template.config.colors.background
        : (themeColor || template.config.colors.background);

    // Map border radius
    const getRadiusValue = (size: 'small' | 'medium' | 'large' = 'large') => {
        switch (size) {
            case 'small': return '12px';
            case 'medium': return '16px';
            case 'large': return '24px';
            default: return '24px';
        }
    };
    const radiusValue = getRadiusValue(borderRadius);

    // Construct Theme Overrides
    // Construct Theme Overrides
    const themeOverrides: DeepPartial<ThemeConfig> = {
        borderRadius: radiusValue,
        colors: {
            ...(themeColor ? { primary: themeColor } : {}),
            ...(themeColor && safeTemplateId === 'classic' ? { background: themeColor } : {}),
            ...(accentColor ? { accent: accentColor } : {})
        }
    };

    return (
        <TemplateProvider
            templateId={safeTemplateId}
            themeOverrides={themeOverrides}
        >
            <main
                className="min-h-screen bg-theme-background transition-colors duration-300 px-4 py-8 relative overflow-hidden"
                style={{ backgroundColor: pageBackgroundColor }}
            >
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <Background />
                </div>

                <div className="max-w-md mx-auto relative z-10 flex flex-col min-h-[90vh]">
                    {profile && (
                        <div className="mb-4 transform scale-90 origin-top">
                            <HeaderComponent
                                profile={profile}
                                contact={contact}
                                showAddress={showHeaderAddress}
                            />

                            {/* Centered Home Navigation */}
                            <div className="flex justify-center mt-2 mb-6">
                                <Link
                                    href="/"
                                    className="group flex items-center gap-3 hover:opacity-80 transition-opacity"
                                >
                                    <div
                                        className={`
                                            p-2 rounded-lg flex items-center justify-center transition-all duration-200
                                            border-[2px]
                                            ${template.config.homeButtonStyle === 'text' ? 'border-transparent' : 'shadow-sticker hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'}
                                        `}
                                        style={{
                                            backgroundColor: template.config.homeButtonColor === 'glass' ? 'rgba(0,0,0,0.05)' : template.config.colors.foreground,
                                            borderColor: template.config.homeButtonColor === 'glass' ? 'transparent' : template.config.colors.foreground
                                        }}
                                    >
                                        <Home
                                            size={20}
                                            style={{ color: template.config.homeButtonColor === 'glass' ? template.config.colors.foreground : template.config.colors.primary }}
                                        />
                                    </div>
                                    <span
                                        className="font-bold text-lg tracking-wide uppercase"
                                        style={{
                                            color: template.config.colors.foreground,
                                            fontFamily: template.config.fonts.heading
                                        }}
                                    >
                                        Home
                                    </span>
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Catalog Content (replacing page.blocks) */}
                    <div className="flex-1">
                        <CatalogClient products={products} />
                    </div>

                    <div className="mt-12">
                        <Footer
                            socialLinks={socialLinks}
                            footerText={footerText}
                            contact={contact}
                            hideContact={hideFooterContact}
                        />
                    </div>
                </div>
            </main>
        </TemplateProvider>
    );
}

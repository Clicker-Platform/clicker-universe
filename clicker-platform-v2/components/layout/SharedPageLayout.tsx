'use client';

import React from 'react';
import { HeaderNavigation } from '@/components/layout/header/HeaderNavigation';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { NavigationProvider } from '@/components/layout/NavigationProvider';
import { InitialNavData } from '@/lib/hooks/useNavigationConfig';
// import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'; // Inlined to fix hydration issues
import { TemplateProvider } from '@/components/TemplateProvider';
import { getTemplate } from '@/lib/templates/registry';
import { ClassicProfileHeader } from "@/components/headers/ClassicProfileHeader";
import { BackgroundDecorations } from "@/components/BackgroundDecorations";
import { Footer } from "@/components/Footer";
import { PageBackground } from '@/components/blocks/PageBackground';

export interface SharedLayoutProps {
    templateId: string;
    // We pass the Full Data object because Header, Footer, etc need various parts.
    data: any; // Using any to avoid complex type duplication until centralized types file is verified.
    children: React.ReactNode;
    pageOverrides?: {
        borderRadius?: 'small' | 'medium' | 'large' | 'none' | 'custom';
        customBorderRadius?: string;
        themeColor?: string;
        customConfig?: any;
        backgroundConfig?: any;
    };
    showFooter?: boolean;
    siteId: string;
    forceMobile?: boolean;
    isSubPage?: boolean;
    pageTitle?: string;
    heroFirst?: boolean;
    initialFormCache?: Record<string, any>;
    initialNavData?: InitialNavData;
}

export function SharedPageLayout({
    templateId,
    data,
    children,
    pageOverrides,
    showFooter = true,
    siteId,
    forceMobile = false,
    isSubPage = false,
    pageTitle,
    heroFirst = false,
    initialFormCache = {},
    initialNavData,
}: SharedLayoutProps) {
    const {
        profile,
        themeColor,
        borderRadius,
        footerText,
        contact,
        socialLinks,
        showHeaderAddress,
        hideFooterContact,
        backgroundColor,
        surfaceColor,
    } = data;

    // Resolve Template
    // Use the passed templateId (which might be from URL or Page Config)
    const activeTemplateId = templateId || 'classic';
    const template = getTemplate(activeTemplateId);

    // Components
    const HeaderComponent = template.components?.Header || ClassicProfileHeader;
    const Background = template.components?.Background || BackgroundDecorations;

    // Styling Logic
    const radiusSize = pageOverrides?.borderRadius || borderRadius || 'large';
    const getRadiusValue = (size: string) => {
        switch (size) {
            case 'none': return '0px';
            case 'small': return '12px';
            case 'medium': return '16px';
            case 'large': return '24px';
            case 'custom': return pageOverrides?.customBorderRadius || data?.customBorderRadius || '24px';
            default: return '24px';
        }
    };
    const radiusValue = getRadiusValue(radiusSize);

    // Theme Color Logic
    const finalThemeColor = pageOverrides?.themeColor || themeColor;
    const isLockedTemplate = template.config.allowThemeColorOverride === false;
    const pageBackgroundColor = isLockedTemplate
        ? (backgroundColor || template.config.colors.background)
        : (finalThemeColor || template.config.colors.background);

    // Build color overrides
    const colorOverrides = isLockedTemplate ? {
        // Locked templates: lock background/surface to template defaults, but
        // still allow the user-selected accent (themeColor) to drive primary/accent
        // so CTA buttons and brand highlights reflect the Appearance panel choice.
        ...(finalThemeColor ? { primary: finalThemeColor, accent: finalThemeColor } : {}),
        ...(data.accentColor ? { foreground: data.accentColor } : {}),
        ...(backgroundColor ? { background: backgroundColor } : {}),
        ...(surfaceColor ? { surface: surfaceColor } : {}),
    } : {
        // Standard templates: apply all user-configured color fields
        ...(finalThemeColor ? { primary: finalThemeColor } : {}),
        ...(data.accentColor ? { foreground: data.accentColor } : {}),
        ...(backgroundColor ? { background: backgroundColor } : {}),
        ...(surfaceColor ? { surface: surfaceColor } : {}),
    };

    return (
        <TemplateProvider
            templateId={activeTemplateId}
            themeOverrides={{
                borderRadius: radiusValue,
                ...(data?.cardVariant ? { cardVariant: data.cardVariant } : {}),
                ...(Object.keys(colorOverrides).length > 0 ? { colors: colorOverrides } : {}),
                ...pageOverrides?.customConfig
            }}
        >
            <NavigationProvider siteId={siteId} initialFormCache={initialFormCache} initialNavData={initialNavData}>
            <div className="contents">
                {/* Navigation */}
                {profile && (
                    <HeaderNavigation
                        profile={profile}
                        siteId={siteId}
                        forceMobile={forceMobile}
                        isSubPage={isSubPage}
                        pageTitle={pageTitle}
                    />
                )}
                <BottomNavBar />


                <main
                    className={`
                        min-h-screen ${heroFirst ? 'pt-0 pb-12' : 'py-12'} relative transition-colors duration-300 overflow-x-clip
                        ${template.config.layout?.navMode === 'adaptive' ? 'pt-16' : ''}
                    `}
                    suppressHydrationWarning // Prevent mismatches on dynamic styles
                >
                    {/* Base Background Fallback */}
                    <div className="absolute inset-0 -z-20 pointer-events-none" style={{ backgroundColor: pageBackgroundColor }} />
                    {/* User Custom Background (Page or Global) */}
                    <PageBackground config={pageOverrides?.backgroundConfig || data.globalBackground} />

                    {/* Background — use absolute instead of fixed to avoid iPadOS WebKit layout quirks */}
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                        <Background />
                    </div>

                    {/* ResponsiveContainer Inlined */}
                    <div
                        className={`w-full mx-auto px-4 md:px-6 transition-all duration-300 relative z-10 flex flex-col gap-6 min-h-[90vh]`}
                        style={{ maxWidth: 'var(--layout-max-width, 480px)' }}
                    >
                        {/* Header */}
                        {profile && (
                            <div>
                                <HeaderComponent
                                    profile={profile}
                                    contact={contact}
                                    showAddress={showHeaderAddress}
                                />
                            </div>
                        )}

                        {/* Content */}
                        {children}

                        {/* Footer */}
                        {showFooter && (
                            <div className="col-span-full">
                                <Footer
                                    socialLinks={socialLinks}
                                    footerText={footerText}
                                    contact={contact}
                                    hideContact={hideFooterContact}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>
            </NavigationProvider>
        </TemplateProvider>
    );
}

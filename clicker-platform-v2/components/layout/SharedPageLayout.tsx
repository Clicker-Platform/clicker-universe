'use client';

import React from 'react';
import { ResponsiveNavBar } from '@/components/layout/ResponsiveNavBar';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { NavigationProvider } from '@/components/layout/NavigationProvider';
import { MODULE_COMPONENTS } from '@/lib/modules/components';

// import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'; // Inlined to fix hydration issues
import { TemplateProvider } from '@/components/TemplateProvider';
import { getTemplate } from '@/lib/templates/registry';
import { ClassicProfileHeader } from "@/components/headers/ClassicProfileHeader";
import { BackgroundDecorations } from "@/components/BackgroundDecorations";
import { Footer } from "@/components/Footer";
import { PublicPageProps } from '@/components/PublicPageRenderer'; // Implied export, might need to export relevant types from definition file if not exported

// We need a way to share the generic props.
// Ideally, PublicData should be imported from types.
// For now, let's mirror the structure or assume Any for data to decouple strictly.
// But strict types are better. Let's try to import PublicPageProps's data shape if possible, 
// OR define a shared interface.
// Since PublicPageRenderer exports PublicPageProps (but not the inner data type separately), let's redefine minimally or assume strict adherence.

export interface SharedLayoutProps {
    templateId: string;
    // We pass the Full Data object because Header, Footer, etc need various parts.
    data: any; // Using any to avoid complex type duplication until centralized types file is verified.
    children: React.ReactNode;
    pageOverrides?: {
        borderRadius?: 'small' | 'medium' | 'large';
        themeColor?: string;
        customConfig?: any;
    };
    showFooter?: boolean;
    siteId: string;
    forceMobile?: boolean;
    isSubPage?: boolean;
    pageTitle?: string;
    heroFirst?: boolean;
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
            case 'small': return '12px';
            case 'medium': return '16px';
            case 'large': return '24px';
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

    // Build color overrides for locked-background templates
    const lockedColorOverrides = isLockedTemplate ? {
        ...(finalThemeColor ? { primary: finalThemeColor, accent: finalThemeColor } : {}),
        ...(backgroundColor ? { background: backgroundColor } : {}),
        ...(surfaceColor ? { surface: surfaceColor } : {}),
    } : {};

    return (
        <TemplateProvider
            templateId={activeTemplateId}
            themeOverrides={{
                borderRadius: radiusValue,
                ...(isLockedTemplate && Object.keys(lockedColorOverrides).length > 0
                    ? { colors: lockedColorOverrides }
                    : {}),
                ...pageOverrides?.customConfig
            }}
        >
            <NavigationProvider siteId={siteId}>
            <div className="contents">
                {/* Navigation */}
                {profile && (
                    <ResponsiveNavBar
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
                        min-h-screen py-12 relative transition-colors duration-300 overflow-x-clip
                        ${template.config.layout?.navMode === 'adaptive' ? 'pt-16' : ''}
                    `}
                    style={{ backgroundColor: pageBackgroundColor }}
                    suppressHydrationWarning // Prevent mismatches on dynamic styles
                >
                    {/* Background — use absolute instead of fixed to avoid iPadOS WebKit layout quirks */}
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                        <Background />
                    </div>

                    {/* ResponsiveContainer Inlined */}
                    <div
                        className={`w-full mx-auto px-4 md:px-6 transition-all duration-300 relative z-10 flex flex-col min-h-[90vh]`}
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

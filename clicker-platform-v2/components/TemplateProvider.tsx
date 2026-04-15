'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getTemplateDefinition } from '@/lib/templates/definitions';
import { TemplateDefinition, ThemeConfig } from '@/lib/templates/types';
import { deepMerge } from '@/lib/utils/deepMerge';
import { getContrastColor } from '@/lib/utils/color';

export interface TemplateContextType {
    templateId: string;
    template: Omit<TemplateDefinition, 'components'>;
    theme: ThemeConfig;
}

export const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

interface TemplateProviderProps {
    templateId: string;
    children: React.ReactNode;
    themeOverrides?: DeepPartial<ThemeConfig>;
}

export const TemplateProvider: React.FC<TemplateProviderProps> = ({ templateId, children, themeOverrides }) => {
    // Initial state from static definition (optimistic loading)
    const staticDef = useMemo(() => getTemplateDefinition(templateId), [templateId]);
    const [activeDefinition, setActiveDefinition] = useState<Omit<TemplateDefinition, 'components'>>(staticDef);

    useEffect(() => {
        let isMounted = true;

        const loadTemplate = async () => {
            // If it's a known static system template, we might skip fetching for perf, 
            // BUT if we want to allow Admin updates to system templates to propagate, we should fetch.
            // For now, let's always fetch to ensure consistency with DB.
            try {
                const { fetchTemplate } = await import('@/lib/templates/service');
                const doc = await fetchTemplate(templateId);

                if (doc && isMounted) {
                    const lockedColors = staticDef.config.allowThemeColorOverride === false;

                    setActiveDefinition({
                        id: doc.id,
                        name: doc.name,
                        description: doc.description,
                        isPro: doc.tier === 'premium',
                        config: {
                            ...staticDef.config,
                            ...doc.config,
                            // If the template locks its colors, always use static definition colors —
                            // never let saved DB values overwrite background, surface, border, etc.
                            colors: lockedColors
                                ? staticDef.config.colors
                                : { ...staticDef.config.colors, ...doc.config.colors },
                            layout: (['shuvo', 'mrb', 'mrb-light'].includes(doc.id) ? staticDef.config.layout : {
                                ...staticDef.config.layout,
                                ...(doc.config.layout || {})
                            }),
                            decorations: {
                                ...staticDef.config.decorations,
                                ...(doc.config.decorations || {})
                            },
                            custom: {
                                ...(staticDef.config.custom || {}),
                                ...(doc.config.custom || {})
                            }
                        } as ThemeConfig
                    });
                }
            } catch (err) {
                console.error("Failed to load template:", err);
            }
        };

        loadTemplate();

        return () => { isMounted = false; };
    }, [templateId, staticDef]);

    // Merge template config with overrides using deep merge
    const theme = useMemo(() => {
        const baseConfig = activeDefinition.config;
        const merged = themeOverrides
            ? deepMerge(baseConfig, themeOverrides) as ThemeConfig
            : baseConfig;

        // Always auto-derive accentForeground from accent/primary luminance
        // so text on accent-colored buttons is always readable,
        // regardless of what value was hardcoded in the template definition.
        const accentColor = merged.colors.accent || merged.colors.primary;
        const autoAccentFg = getContrastColor(accentColor);
        return {
            ...merged,
            colors: {
                ...merged.colors,
                accentForeground: autoAccentFg,
            },
        };
    }, [activeDefinition, themeOverrides]);

    const template = useMemo(() => ({
        ...activeDefinition,
        config: theme
    }), [activeDefinition, theme]);

    // Inject CSS variables into a root element or style tag
    const cssVars = useMemo(() => {
        const vars: Record<string, string> = {
            '--theme-primary': theme.colors.primary,
            '--theme-background': theme.colors.background,
            '--theme-foreground': theme.colors.foreground,
        };

        if (theme.colors.accent) vars['--theme-accent'] = theme.colors.accent;
        if (theme.colors.surface) vars['--theme-surface'] = theme.colors.surface;
        if (theme.colors.border) vars['--theme-border'] = theme.colors.border;

        // Inject border radius
        if (theme.borderRadius) vars['--theme-radius'] = theme.borderRadius;

        // Inject Fonts
        if (theme.fonts?.heading) vars['--font-heading'] = theme.fonts.heading;
        if (theme.fonts?.body) vars['--font-body'] = theme.fonts.body;

        // --- Responsive Layout Logic ---
        const layout = theme.layout || {
            containerWidth: 'narrow',
            navMode: 'mobile-only',
            grid: { mobile: 1, tablet: 1, desktop: 1, gap: 'gap-4' }
        };

        // 1. Container Width
        const widthMap = {
            narrow: '480px',
            boxed: '1024px',
            tablet: '768px',
            full: '100%'
        };
        vars['--layout-max-width'] = widthMap[layout.containerWidth as keyof typeof widthMap] || '480px';

        // 2. Grid Columns
        vars['--grid-cols-mobile'] = String(layout.grid?.mobile || 1);
        vars['--grid-cols-tablet'] = String(layout.grid?.tablet || 2);
        vars['--grid-cols-desktop'] = String(layout.grid?.desktop || 3);

        // 3. Grid Gap (Convert tailwind class to rough pixel value if needed, 
        // but for now we might use this in a class generator or just pass it through if we use inline style. 
        // Actually, pure CSS grid gap needs a value. 
        // Let's assume the renderer will use the tailwind class `gap-x`, 
        // BUT if we want dynamic gap we need to map it or use a variable.
        // For simplicity, let's map common gaps or use a default rem).
        const gapMap: Record<string, string> = {
            'gap-0': '0px',
            'gap-1': '0.25rem',
            'gap-2': '0.5rem',
            'gap-3': '0.75rem',
            'gap-4': '1rem',
            'gap-5': '1.25rem',
            'gap-6': '1.5rem',
            'gap-8': '2rem',
            'gap-10': '2.5rem',
            'gap-12': '3rem',
        };
        vars['--grid-gap'] = gapMap[layout.grid?.gap || 'gap-4'] || '1rem';

        return vars;
    }, [theme]);

    return (
        <TemplateContext.Provider value={{ templateId, template, theme }}>
            <div
                data-template={templateId}
                className="contents"
                style={cssVars as React.CSSProperties}
            >
                {children}
            </div>
        </TemplateContext.Provider>
    );
};

export const useTemplate = () => {
    const context = useContext(TemplateContext);
    if (!context) {
        throw new Error('useTemplate must be used within a TemplateProvider');
    }
    return context;
};

import React from 'react';
import type { ButtonPackId } from '@/lib/buttonPacks/types';

// Keep existing TemplateId for backward compatibility during migration, 
// but allow string for dynamic IDs.
export type TemplateId = 'classic' | 'modern' | 'sojourner' | string;

export interface ThemeColors {
    primary: string;
    secondary?: string;
    accent?: string;
    background: string;
    foreground: string;
    surface?: string;
    border?: string;
    muted?: string;
    // Extended tokens — optional, fall back gracefully on old templates
    accentForeground?: string;  // text color placed on top of accent/primary buttons
    surfaceElevated?: string;   // elevated card/panel surface (lifts off background)
    textMuted?: string;         // secondary text (labels, subtitles)
    textSubtle?: string;        // tertiary text (captions, meta, placeholders)
    // Semantic status tokens — same across all tenants (not user-customizable in v1)
    error?: string;             // error text/icon color
    errorBg?: string;           // error region background
    success?: string;           // success text/icon color
    successBg?: string;         // success region background
    warning?: string;           // warning text/icon color
    warningBg?: string;         // warning region background
    overlay?: string;           // semi-transparent scrim for photo badges, modals
}

export interface BackgroundElement {
    icon: string;
    position: string; // Tailwind class e.g. "top-10 left-4"
    rotation: number; // Degrees
    size?: string; // Tailwind class e.g. "w-16 h-16"
    colorClass?: string; // Tailwind class e.g. "bg-brand-green"
}

export interface TemplateConfig {
    colors: ThemeColors;
    defaultFontPackId: string;
    defaultButtonPackId?: ButtonPackId;
    borderRadius: string;
    // Deprecated: cardStyle in favor of cardVariant, but keeping for compatibility
    cardStyle: 'brutalist' | 'clean' | 'glass';
    cardVariant: 'shadow' | 'outlined' | 'flat'; // New explicit control
    backgroundElements?: BackgroundElement[];
    allowThemeColorOverride?: boolean; // Defaults to true. If false, template background supercedes user theme color.

    // Header & Layout Tokens
    headerLayout: 'center' | 'left' | 'minimal';
    homeButtonStyle: 'pill' | 'text' | 'icon';
    homeButtonColor: 'primary' | 'foreground' | 'glass';
    taglineStyle: 'contrast' | 'gentle' | 'outline'; // New token

    // --- New Responsive Layout Engine (Phase 2) ---
    layout?: TemplateLayoutConfig;

    // --- Template-Specific Configuration (Phase 3) ---
    // Flexible bucket for settings specific to a single template (e.g. Shuvo-only options)
    custom?: Record<string, any>;

    // --- Decoration Tokens ---
    decorations?: {
        surfaceStyle?: 'glass' | 'soft' | 'outline' | 'solid'; // glass = MRB, soft = MRB-Light, outline = clean bordered
        accentGlow?: boolean; // neon glow effect on accent elements (MRB: true, light themes: false)
        neutralTone?: 'warm' | 'cool' | 'neutral'; // shapes auto-derived grays (warm = cream/sand, cool = slate, neutral = gray)
    };
}

export interface TemplateGridConfig {
    mobile: number; // Columns on mobile (default 1)
    tablet: number; // Columns on tablet (default 2)
    desktop: number; // Columns on desktop (default 3 or 4)
    gap: string;    // Tailwind gap class e.g. 'gap-4'
}

export interface TemplateLayoutConfig {
    // Controls the max-width of the main container
    containerWidth: 'narrow' | 'boxed' | 'full' | 'tablet';
    // 'narrow' = 480px (Classic Link-in-bio)
    // 'boxed' = 1024px (Modern Web App)
    // 'full' = 100% (Dashboard / Immersive)

    // Controls navigation style behavior
    navMode: 'mobile-only' | 'adaptive';
    // 'mobile-only' = Always Bottom Bar / Drawer
    // 'adaptive' = Bottom Bar (Mobile) -> Top Bar (Desktop)

    // Explicitly toggle features
    showBottomNav?: boolean;

    // Grid System configuration
    grid: TemplateGridConfig;
}

export type ThemeConfig = TemplateConfig;

export interface TemplateComponents {
    // We will type these more strictly as we create the specific component props
    Header: React.ElementType<any>;
    Background: React.ElementType<any>;
    // Optional overrides for system and custom page blocks
    Blocks?: {
        // System Blocks
        QuickActions?: React.ElementType<any>;
        OperatingHours?: React.ElementType<any>;
        Branches?: React.ElementType<any>;
        FeaturedProduct?: React.ElementType<any>;

        // Custom Page Content Blocks
        Hero?: React.ElementType<any>;
        Text?: React.ElementType<any>;
        Image?: React.ElementType<any>;
        Button?: React.ElementType<any>;
        Products?: React.ElementType<any>;
        FAQ?: React.ElementType<any>;
        Link?: React.ElementType<any>;
        Map?: React.ElementType<any>;
        ImageGallery?: React.ElementType<any>;
        InlineFormBlock?: React.ElementType<any>;
        HeadingBlock?: React.ElementType<any>;
    };
}

export interface TemplateDefinition {
    id: TemplateId;
    name: string;
    description: string;
    isPro?: boolean;
    config: ThemeConfig;
    components?: TemplateComponents; // Optional during transition
    homeBlockOrder?: string[];
    thumbnailUrl?: string;
}

// --- Firestore Document Schema ---

export interface TemplateDocument {
    id: string; // 'classic', 'modern', or UUID
    name: string;
    description: string;
    type: 'system' | 'custom'; // 'system' = predefined, 'custom' = user made
    tier: 'free' | 'premium';
    status: 'active' | 'inactive';
    config: ThemeConfig;
    thumbnailUrl?: string;
    ownerId?: string | null; // Null for system templates
    createdAt?: any; // Timestamp
    updatedAt?: any; // Timestamp
}

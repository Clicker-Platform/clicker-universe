import type { CSSProperties } from 'react';
import type { ThemeColors, TemplateConfig } from '@/lib/templates/types';

type CardStyle = TemplateConfig['cardStyle'] | string | undefined;
type Theme = { colors: ThemeColors };

/**
 * Returns a CSS color string with opacity applied. Accepts:
 *  - hex (#rrggbb or #rgb)
 *  - rgb()/rgba() — opacity multiplies existing alpha
 *  - var(--*) — falls back to rgba wrapping if the var resolves; otherwise returns the
 *    expression as-is for the browser to render (use with restraint).
 * Throws on unsupported formats so calling code fails loudly during migration.
 */
export function hexWithOpacity(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    const trimmed = color.trim();

    // Already rgba/rgb — replace or append alpha
    const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(',').map(s => s.trim());
        const [r, g, b] = parts;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    // Hex: #rgb, #rrggbb
    const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    // CSS var or unknown — cannot apply opacity at runtime without parsing.
    // Return as-is; callers should prefer prebaked rgba in theme tokens.
    return trimmed;
}

/**
 * Heading color (H1, H2, H3). On glass surfaces we lift the foreground toward
 * near-white for legibility; otherwise we use theme.foreground directly.
 */
export function getHeadingColor(cardStyle: CardStyle, theme: Theme): string {
    if (cardStyle === 'glass') return 'rgba(255, 255, 255, 0.98)';
    return theme.colors.foreground;
}

/**
 * Body color (body, body-lg). Slightly softer on glass than headings.
 */
export function getBodyColor(cardStyle: CardStyle, theme: Theme): string {
    if (cardStyle === 'glass') return 'rgba(255, 255, 255, 0.85)';
    return theme.colors.foreground;
}

/**
 * Muted / secondary text (captions, body-sm, price, address, subtitle).
 * Prefers theme.colors.textMuted; falls back to foreground at 65% opacity.
 */
export function getMutedColor(cardStyle: CardStyle, theme: Theme): string {
    if (cardStyle === 'glass') return 'rgba(255, 255, 255, 0.6)';
    if (theme.colors.textMuted) return theme.colors.textMuted;
    return hexWithOpacity(theme.colors.foreground, 0.65);
}

/**
 * Label / eyebrow (H4). Slightly muted heading color, sits between heading and body.
 */
export function getLabelColor(cardStyle: CardStyle, theme: Theme): string {
    if (cardStyle === 'glass') return 'rgba(255, 255, 255, 0.7)';
    if (theme.colors.textMuted) return theme.colors.textMuted;
    return hexWithOpacity(theme.colors.foreground, 0.7);
}

/**
 * Accent color (links, primary CTAs, key brand highlights). Always theme.primary.
 */
export function getAccentColor(theme: Theme): string {
    return theme.colors.primary;
}

/**
 * Returns the appropriate CSS class string for block cards based on the template's cardStyle.

/**
 * Returns the appropriate CSS class string for block cards based on the template's cardStyle.
 * Shadow is controlled by --theme-card-shadow (derived from cardVariant in TemplateProvider).
 * 'clean'    → minimal white card with light border
 * 'glass'    → dark glassmorphic surface (for dark-mode templates like mrb)
 * default    → brutalist sticker style (thick border + shadow)
 */
export function getCardClasses(cardStyle?: string, extra?: string): string {
    const base = extra ? ` ${extra}` : '';
    if (cardStyle === 'clean') {
        return `bg-white border border-gray-200 [box-shadow:var(--theme-card-shadow)]${base}`;
    }
    if (cardStyle === 'glass') {
        // Background uses --theme-surface with opacity so user surface color overrides apply.
        return `backdrop-blur-md border border-white/10 overflow-hidden [box-shadow:var(--theme-card-shadow)] [background:color-mix(in_srgb,var(--theme-surface)_60%,transparent)]${base}`;
    }
    // brutalist / default — keeps shadow-sticker (decorative offset shadow, not cardVariant-controlled)
    return `bg-white border-[3px] border-theme-border shadow-sticker overflow-hidden${base}`;
}

/**
 * Returns inline style for glass card backgrounds that respect the user-configured surface color.
 * Use this alongside getCardClasses() when you need an explicit inline style (e.g. when Tailwind
 * JIT cannot pick up the dynamic color-mix expression).
 */
export function getGlassStyle(surfaceColor?: string): CSSProperties {
    const base = surfaceColor || 'var(--theme-surface, #1a1a1a)';
    return {
        background: `color-mix(in srgb, ${base} 60%, transparent)`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
    };
}

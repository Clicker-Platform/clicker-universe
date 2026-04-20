import type { CSSProperties } from 'react';

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

export function getTextColor(cardStyle?: string, muted = false): string {
    if (cardStyle === 'glass') {
        return muted ? 'text-white/60' : 'text-theme-foreground/60';
    }
    return muted ? 'text-gray-500' : 'text-theme-foreground';
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

/**
 * Returns the appropriate CSS class string for block cards based on the template's cardStyle.
 * 'clean'    → minimal white card with light border
 * 'glass'    → dark glassmorphic surface (for dark-mode templates like mrb)
 * default    → brutalist sticker style (thick border + shadow)
 */
export function getCardClasses(cardStyle?: string, extra?: string): string {
    const base = extra ? ` ${extra}` : '';
    if (cardStyle === 'clean') {
        return `bg-white border border-gray-200 shadow-sm${base}`;
    }
    if (cardStyle === 'glass') {
        return `bg-black/20 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden${base}`;
    }
    // brutalist / default
    return `bg-white border-[3px] border-theme-border shadow-sticker overflow-hidden${base}`;
}

export function getTextColor(cardStyle?: string, muted = false): string {
    if (cardStyle === 'glass') {
        return muted ? 'text-white/60' : 'text-white';
    }
    return muted ? 'text-gray-500' : 'text-theme-foreground';
}

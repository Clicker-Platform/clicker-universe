/**
 * Color utilities for dynamic contrast calculation.
 *
 * Uses W3C relative-luminance formula (WCAG 2.x) to decide whether text
 * placed on a given background color should be light or dark.
 */

/**
 * Parse a hex color string (3, 4, 6, or 8 chars) into [r, g, b] (0–255).
 * Returns null if the string is not a valid hex color.
 */
function hexToRgb(hex: string): [number, number, number] | null {
    const cleaned = hex.replace('#', '');
    let r: number, g: number, b: number;

    if (cleaned.length === 3 || cleaned.length === 4) {
        r = parseInt(cleaned[0] + cleaned[0], 16);
        g = parseInt(cleaned[1] + cleaned[1], 16);
        b = parseInt(cleaned[2] + cleaned[2], 16);
    } else if (cleaned.length === 6 || cleaned.length === 8) {
        r = parseInt(cleaned.substring(0, 2), 16);
        g = parseInt(cleaned.substring(2, 4), 16);
        b = parseInt(cleaned.substring(4, 6), 16);
    } else {
        return null;
    }

    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
}

/**
 * Calculate relative luminance of a color per WCAG 2.x.
 * Returns a value between 0 (black) and 1 (white).
 */
function relativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Given a background color (hex string), return the best contrasting
 * foreground color — either `lightColor` or `darkColor`.
 *
 * Uses a luminance threshold of 0.4 (slightly biased toward white text)
 * to match common design expectations.
 *
 * @param bgColor   Hex color string, e.g. '#000000', '#FAF7F2'
 * @param lightColor Returned when background is dark (default: '#ffffff')
 * @param darkColor  Returned when background is light (default: '#1a1a1a')
 */
export function getContrastColor(
    bgColor: string,
    lightColor = '#ffffff',
    darkColor = '#1a1a1a',
): string {
    const rgb = hexToRgb(bgColor);
    if (!rgb) return darkColor; // Fallback for non-hex values (rgb(), hsl(), etc.)

    const luminance = relativeLuminance(...rgb);
    return luminance > 0.4 ? darkColor : lightColor;
}

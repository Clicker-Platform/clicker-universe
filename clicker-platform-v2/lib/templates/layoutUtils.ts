
/**
 * layoutUtils.ts
 * Helpers for the Responsive Grid Engine.
 */

// Default span mapping for blocks on Desktop (3+ columns)
// Mobile is always col-span-1 (full width of the 1-col grid)
const SPAN_DEFAULTS: Record<string, string> = {
    // Full width blocks
    'hero': 'md:col-span-2',
    'gallery': 'md:col-span-2',
    'image_gallery': 'md:col-span-2',
    'map': 'md:col-span-2',
    'youtube': 'md:col-span-2',

    // Wide blocks (2 cols)
    'social_embed': 'md:col-span-2',
    'featured_product': 'md:col-span-2',
    'newsletter': 'md:col-span-2',
    'products': 'md:col-span-2',

    // Standard blocks (1 col)
    'quick_actions': 'col-span-1', // aka Link List
    'hours': 'col-span-1',
    'socials': 'col-span-1',
    'contact_form': 'md:col-span-2',
};

/**
 * Returns the Tailwind classes for a block's column span.
 * Currently defaults to 'col-span-full' on mobile (implicit in 1-col grid)
 * and specific spans on 'md' (tablet/desktop).
 */
export const getBlockSpan = (blockType: string): string => {
    // If unknown, default to full width to be safe? 
    // Or default to 1 col? 
    // Standard "Link" blocks should probably be 1 col in a grid.
    return SPAN_DEFAULTS[blockType] || 'col-span-1';
};

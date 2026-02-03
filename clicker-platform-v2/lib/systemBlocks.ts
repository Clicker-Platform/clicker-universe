import { PageBlock } from '@/data/mockData';

/**
 * System Block IDs that can be rendered on the homepage
 */
export const SYSTEM_BLOCK_IDS = {
    QUICK_ACTIONS: 'quick_actions',
    BRANCHES: 'branches',
    FEATURED: 'featured',
    GALLERY: 'gallery',
    HOURS: 'hours',
} as const;

/**
 * Generate system blocks from homeBlockOrder configuration
 * These are the blocks managed via Appearance > Block Layout
 */
export function generateSystemBlocks(
    homeBlockOrder: string[] = [],
    hiddenBlockIds: string[] = []
): PageBlock[] {
    const blocks: PageBlock[] = [];

    // Filter out hidden blocks
    const visibleBlockIds = homeBlockOrder.filter(id => !hiddenBlockIds.includes(id));

    for (const blockId of visibleBlockIds) {
        let block: PageBlock | null = null;

        switch (blockId) {
            case SYSTEM_BLOCK_IDS.QUICK_ACTIONS:
                block = {
                    id: 'quick_actions',
                    type: 'quick_actions',
                    data: {}
                };
                break;

            case SYSTEM_BLOCK_IDS.BRANCHES:
                block = {
                    id: 'branches',
                    type: 'branches',
                    data: {}
                };
                break;

            case SYSTEM_BLOCK_IDS.FEATURED:
                block = {
                    id: 'featured',
                    type: 'featured_product',
                    data: {}
                };
                break;

            case SYSTEM_BLOCK_IDS.GALLERY:
                block = {
                    id: 'gallery',
                    type: 'products',
                    data: {} // ProductsBlock will use siteId to fetch products
                };
                break;

            case SYSTEM_BLOCK_IDS.HOURS:
                block = {
                    id: 'hours',
                    type: 'hours',
                    data: {}
                };
                break;

            default:
                console.warn(`Unknown system block ID: ${blockId}`);
        }

        if (block) {
            blocks.push(block);
        }
    }

    return blocks;
}

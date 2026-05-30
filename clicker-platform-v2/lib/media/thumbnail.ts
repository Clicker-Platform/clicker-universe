import type { MediaItem } from './types';

/**
 * Returns the URL admin surfaces should render for a thumbnail. Prefers the
 * stored small variant but falls back to the full image for legacy items
 * registered before the thumbnail pipeline existed.
 */
export function getDisplayThumbnail(item: Pick<MediaItem, 'url' | 'thumbnailUrl'>): string {
    return item.thumbnailUrl || item.url;
}

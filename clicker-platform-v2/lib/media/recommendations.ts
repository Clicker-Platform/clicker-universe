import type { MediaAspectRatio } from '@/components/admin/blocks/media-field/types';

export interface RecommendedSize {
    width: number;
    height: number;
    label: string;
}

const RECOMMENDED_BY_ASPECT: Record<MediaAspectRatio, RecommendedSize> = {
    '16:9': { width: 1280, height: 720, label: '1280×720' },
    '4:3': { width: 1024, height: 768, label: '1024×768' },
    'square': { width: 1024, height: 1024, label: '1024×1024' },
    '3:4': { width: 768, height: 1024, label: '768×1024' },
    'free': { width: 1280, height: 960, label: '1280×960' },
};

export function getRecommendedSize(aspectRatio: MediaAspectRatio | undefined): RecommendedSize {
    return RECOMMENDED_BY_ASPECT[aspectRatio || '16:9'];
}

const MIN_RATIO = 0.5;

export function isBelowRecommended(
    natural: { width: number; height: number },
    aspectRatio: MediaAspectRatio | undefined,
): boolean {
    const rec = getRecommendedSize(aspectRatio);
    return natural.width < rec.width * MIN_RATIO || natural.height < rec.height * MIN_RATIO;
}

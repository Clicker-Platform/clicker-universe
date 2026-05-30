import { Timestamp } from 'firebase/firestore';

export interface MediaItem {
    id: string;
    url: string;
    storagePath: string;
    /** URL of the small (max-edge ~600px) variant used by admin thumbnails. Falls back to `url` when absent. */
    thumbnailUrl?: string;
    /** Storage path of the thumbnail blob, so deleteMedia can clean it up. */
    thumbnailStoragePath?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    folder: string;
    tags: string[];
    uploadedAt: Timestamp;
    uploadedBy: string;
}

export type MediaUsageType = 'page' | 'link' | 'form' | 'business';

export interface MediaUsage {
    type: MediaUsageType;
    id: string;
    label: string;
    location: string;
}

export class MediaInUseError extends Error {
    usages: MediaUsage[];
    constructor(usages: MediaUsage[]) {
        super(`Media item is in use (${usages.length} reference${usages.length === 1 ? '' : 's'})`);
        this.name = 'MediaInUseError';
        this.usages = usages;
    }
}

export const DEFAULT_FOLDER = 'Uncategorized';
export const IMPORTED_FOLDER = 'Imported';

import { Timestamp } from 'firebase/firestore';

export interface MediaItem {
    id: string;
    url: string;
    storagePath: string;
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

export const DEFAULT_FOLDER = 'uncategorized';
export const IMPORTED_FOLDER = 'Imported';

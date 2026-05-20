import type { MediaItem, MediaUsage } from './types';

export async function registerMedia(_args: {
    siteId: string;
    file: File;
    folder?: string;
    tags?: string[];
    uploadedBy: string;
}): Promise<MediaItem> {
    throw new Error('not implemented');
}

export async function listMedia(_args: {
    siteId: string;
    folder?: string;
    tag?: string;
    search?: string;
}): Promise<MediaItem[]> {
    throw new Error('not implemented');
}

export async function updateMedia(_siteId: string, _id: string, _patch: Partial<MediaItem>): Promise<void> {
    throw new Error('not implemented');
}

export async function findUsages(_siteId: string, _url: string): Promise<MediaUsage[]> {
    throw new Error('not implemented');
}

export async function deleteMedia(_siteId: string, _id: string, _options?: { force?: boolean }): Promise<void> {
    throw new Error('not implemented');
}

export async function importExistingMedia(_siteId: string, _uploadedBy: string): Promise<{ imported: number; skipped: number }> {
    throw new Error('not implemented');
}

export { MediaInUseError } from './types';

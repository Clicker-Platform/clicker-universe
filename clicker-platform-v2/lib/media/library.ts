import { db } from '@/lib/firebase';
import { uploadToStorage } from '@/lib/upload';
import { collection, doc, setDoc, getDocs, getDoc, query, where, orderBy, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { MediaItem, MediaUsage } from './types';
import { DEFAULT_FOLDER, MediaInUseError } from './types';

function extractStoragePath(url: string): string {
    // Firebase Storage download URLs look like:
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>?alt=media&token=...
    const match = url.match(/\/o\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : url;
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    if (!file.type.startsWith('image/') || typeof window === 'undefined') return null;
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            resolve(null);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
}

export async function registerMedia({
    siteId,
    file,
    folder,
    tags,
    uploadedBy,
}: {
    siteId: string;
    file: File;
    folder?: string;
    tags?: string[];
    uploadedBy: string;
}): Promise<MediaItem> {
    const url = await uploadToStorage({ file, folder: 'media', siteId, convertToWebP: true });
    const dims = await readImageDimensions(file);
    const colRef = collection(db, 'sites', siteId, 'mediaLibrary');
    const docRef = doc(colRef);

    const item: MediaItem = {
        id: docRef.id,
        url,
        storagePath: extractStoragePath(url),
        fileName: file.name,
        mimeType: file.type || 'image/webp',
        sizeBytes: file.size,
        ...(dims ? { width: dims.width, height: dims.height } : {}),
        folder: folder ?? DEFAULT_FOLDER,
        tags: tags ?? [],
        uploadedAt: Timestamp.now(),
        uploadedBy,
    };

    await setDoc(docRef, item);
    return item;
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

// Suppress unused import warnings for stubs (used in future tasks)
void getDocs; void getDoc; void query; void where; void orderBy; void deleteDoc; void updateDoc;

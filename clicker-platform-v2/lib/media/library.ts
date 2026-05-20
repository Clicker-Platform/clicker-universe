import { db, storage } from '@/lib/firebase';
import { uploadToStorage } from '@/lib/upload';
import { collection, doc, setDoc, getDocs, getDoc, query, where, orderBy, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, deleteObject, listAll, getDownloadURL, getMetadata } from 'firebase/storage';
import type { MediaItem, MediaUsage } from './types';
import { DEFAULT_FOLDER, IMPORTED_FOLDER, MediaInUseError } from './types';

function extractStoragePath(url: string): string {
    // Firebase Storage download URLs look like:
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>?alt=media&token=...
    const match = url.match(/\/o\/([^?]+)/);
    if (!match) return url;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return url;
    }
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
    const { url, contentType, sizeBytes } = await uploadToStorage({ file, folder: 'media', siteId, convertToWebP: true });
    const dims = await readImageDimensions(file);
    const colRef = collection(db, 'sites', siteId, 'mediaLibrary');
    const docRef = doc(colRef);

    const item: MediaItem = {
        id: docRef.id,
        url,
        storagePath: extractStoragePath(url),
        fileName: file.name,
        mimeType: contentType,
        sizeBytes,
        ...(dims ? { width: dims.width, height: dims.height } : {}),
        folder: folder ?? DEFAULT_FOLDER,
        tags: tags ?? [],
        uploadedAt: Timestamp.now(),
        uploadedBy,
    };

    await setDoc(docRef, item);
    return item;
}

export async function listMedia({
    siteId,
    folder,
    tag,
    search,
}: {
    siteId: string;
    folder?: string;
    tag?: string;
    search?: string;
}): Promise<MediaItem[]> {
    const colRef = collection(db, 'sites', siteId, 'mediaLibrary');
    const snap = await getDocs(query(colRef, orderBy('uploadedAt', 'desc')));
    let items = snap.docs.map(d => d.data() as MediaItem);

    if (folder) items = items.filter(i => i.folder === folder);
    if (tag) items = items.filter(i => i.tags.includes(tag));
    if (search) {
        const needle = search.toLowerCase();
        items = items.filter(i => i.fileName.toLowerCase().includes(needle));
    }
    return items;
}

export type MediaPatch = Partial<Pick<MediaItem, 'fileName' | 'folder' | 'tags'>>;

export async function updateMedia(siteId: string, id: string, patch: MediaPatch): Promise<void> {
    const ref = doc(db, 'sites', siteId, 'mediaLibrary', id);
    await updateDoc(ref, patch);
}

function containsUrl(value: unknown, url: string): boolean {
    return JSON.stringify(value ?? '').includes(url);
}

export async function findUsages(siteId: string, url: string): Promise<MediaUsage[]> {
    const usages: MediaUsage[] = [];

    // Pages — scan full doc; some templates store media at root (coverImage, etc.) not only in blocks.
    const pagesSnap = await getDocs(collection(db, 'sites', siteId, 'pages'));
    for (const d of pagesSnap.docs) {
        const data = d.data() as any;
        if (containsUrl(data, url)) {
            usages.push({
                type: 'page',
                id: d.id,
                label: `Page: ${data.name || data.title || d.id}`,
                location: 'Page content',
            });
        }
    }

    // Links
    const linksSnap = await getDocs(collection(db, 'sites', siteId, 'links'));
    for (const d of linksSnap.docs) {
        const data = d.data() as any;
        if (containsUrl(data, url)) {
            usages.push({
                type: 'link',
                id: d.id,
                label: `Link: ${data.title || data.label || d.id}`,
                location: 'Link properties',
            });
        }
    }

    // Forms
    const formsSnap = await getDocs(collection(db, 'sites', siteId, 'forms'));
    for (const d of formsSnap.docs) {
        const data = d.data() as any;
        if (containsUrl(data, url)) {
            usages.push({
                type: 'form',
                id: d.id,
                label: `Form: ${data.name || data.title || d.id}`,
                location: 'Form schema',
            });
        }
    }

    // Business profile lives at content/business in this codebase (not settings/business).
    const bizSnap = await getDoc(doc(db, 'sites', siteId, 'content', 'business'));
    if (bizSnap.exists() && containsUrl(bizSnap.data(), url)) {
        usages.push({
            type: 'business',
            id: 'business',
            label: 'Business profile',
            location: 'Profile fields',
        });
    }

    return usages;
}

export async function deleteMedia(
    siteId: string,
    id: string,
    options?: { force?: boolean },
): Promise<void> {
    const ref = doc(db, 'sites', siteId, 'mediaLibrary', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const item = snap.data() as MediaItem;

    if (!options?.force) {
        const usages = await findUsages(siteId, item.url);
        if (usages.length > 0) throw new MediaInUseError(usages);
    }

    await deleteObject(storageRef(storage, item.storagePath)).catch(() => {
        // Storage object may already be gone — non-fatal
    });
    await deleteDoc(ref);
}

const IMAGE_MIMES = new Set(['image/webp', 'image/avif', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']);

export async function importExistingMedia(
    siteId: string,
    uploadedBy: string,
): Promise<{ imported: number; skipped: number }> {
    const root = storageRef(storage, `sites/${siteId}/media`);
    let listing;
    try {
        listing = await listAll(root);
    } catch {
        return { imported: 0, skipped: 0 };
    }

    let imported = 0;
    let skipped = 0;
    const colRef = collection(db, 'sites', siteId, 'mediaLibrary');
    for (const obj of listing.items) {
        const [meta, url] = await Promise.all([getMetadata(obj), getDownloadURL(obj)]);
        if (!meta.contentType || !IMAGE_MIMES.has(meta.contentType)) {
            skipped++;
            continue;
        }
        const existing = await getDocs(query(colRef, where('storagePath', '==', obj.fullPath)));
        if (!existing.empty) {
            skipped++;
            continue;
        }
        const usages = await findUsages(siteId, url);
        if (usages.length === 0) {
            skipped++;
            continue;
        }
        const docRef = doc(colRef);
        const item: MediaItem = {
            id: docRef.id,
            url,
            storagePath: obj.fullPath,
            fileName: obj.name,
            mimeType: meta.contentType,
            sizeBytes: meta.size ?? 0,
            folder: IMPORTED_FOLDER,
            tags: [],
            uploadedAt: Timestamp.now(),
            uploadedBy,
        };
        await setDoc(docRef, item);
        imported++;
    }
    return { imported, skipped };
}

/**
 * Background reconciliation pass: for each item, fetch the actual Storage object size
 * and update the Firestore record if it diverges from `sizeBytes`.
 *
 * Earlier versions of registerMedia wrote the source-file size instead of the converted
 * blob size, so historical items overstate their footprint. Callers should fire-and-forget
 * this and not await it; failures per item are swallowed and logged.
 *
 * Returns the number of records that were corrected.
 */
export async function reconcileMediaSizes(siteId: string, items: MediaItem[]): Promise<number> {
    let corrected = 0;
    for (const item of items) {
        try {
            const meta = await getMetadata(storageRef(storage, item.storagePath));
            const actual = meta.size ?? 0;
            if (actual > 0 && actual !== item.sizeBytes) {
                await updateDoc(doc(db, 'sites', siteId, 'mediaLibrary', item.id), { sizeBytes: actual });
                corrected++;
            }
        } catch {
            // Storage object missing or unreadable — skip silently.
        }
    }
    return corrected;
}

export { MediaInUseError } from './types';

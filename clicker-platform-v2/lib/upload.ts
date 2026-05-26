/**
 * Client-side Firebase Storage upload utility.
 * Bypasses server API routes to avoid Turbopack firebase-admin hashing bug.
 */
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface UploadOptions {
    file: File;
    folder: string;
    siteId?: string;
    /** Convert to modern format before upload. Defaults to true for image/* files. */
    convertToWebP?: boolean;
    /** Encoding quality 0–1. Defaults to 0.92. */
    webpQuality?: number;
    /** If set, the image is downscaled (preserving aspect ratio) so its longest edge ≤ this value before encoding. Caps both width and height — works for portrait, landscape, and square images. */
    maxWidth?: number;
}

/**
 * Attempts to encode a canvas to a given MIME type.
 * Returns null if the browser doesn't support it.
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob && blob.type === mimeType ? blob : null);
        }, mimeType, quality);
    });
}

/**
 * Converts an image File to WebP (preferred) or AVIF (fallback).
 * Throws if neither format is supported by the browser.
 */
async function convertImage(
    file: File,
    quality = 0.92,
    maxWidth?: number,
): Promise<{ blob: Blob; ext: string; contentType: string }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = async () => {
            URL.revokeObjectURL(url);
            // Cap the longest edge (not just width) so portrait images shrink too.
            const longest = Math.max(img.naturalWidth, img.naturalHeight);
            const scale = maxWidth && longest > maxWidth ? maxWidth / longest : 1;
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas 2D context unavailable'));
                return;
            }
            ctx.drawImage(img, 0, 0, w, h);

            // Try WebP first, fall back to AVIF
            const webp = await canvasToBlob(canvas, 'image/webp', quality);
            if (webp) {
                resolve({ blob: webp, ext: 'webp', contentType: 'image/webp' });
                return;
            }

            const avif = await canvasToBlob(canvas, 'image/avif', quality);
            if (avif) {
                resolve({ blob: avif, ext: 'avif', contentType: 'image/avif' });
                return;
            }

            reject(new Error('Browser does not support WebP or AVIF encoding'));
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for conversion'));
        };

        img.src = url;
    });
}

/**
 * Upload a file directly to Firebase Storage from the client.
 * Images are converted to WebP (or AVIF if WebP unavailable) before upload.
 * Returns the download URL, actual stored content type, and stored byte size
 * — the latter two reflect the post-conversion blob, not the original file.
 */
export async function uploadToStorage({
    file,
    folder,
    siteId,
    convertToWebP = true,
    webpQuality = 0.92,
    maxWidth,
}: UploadOptions): Promise<{ url: string; contentType: string; sizeBytes: number; path: string }> {
    const storagePrefix = (!siteId || siteId === 'platform')
        ? folder
        : `sites/${siteId}/${folder}`;

    const shouldConvert = convertToWebP && file.type.startsWith('image/') && file.type !== 'image/gif';
    const { blob, ext, contentType } = shouldConvert
        ? await convertImage(file, webpQuality, maxWidth)
        : { blob: file, ext: file.name.split('.').pop() || 'jpg', contentType: file.type };

    const fileName = `${storagePrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const storageRef = ref(storage, fileName);

    await uploadBytes(storageRef, blob, { contentType });

    return { url: await getDownloadURL(storageRef), contentType, sizeBytes: blob.size, path: fileName };
}

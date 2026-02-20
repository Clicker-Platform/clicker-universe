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
}

/**
 * Upload a file directly to Firebase Storage from the client.
 * Returns the download URL of the uploaded file.
 */
export async function uploadToStorage({ file, folder, siteId }: UploadOptions): Promise<string> {
    // Build site-aware storage path
    const storagePrefix = (!siteId || siteId === 'platform')
        ? folder
        : `sites/${siteId}/${folder}`;

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${storagePrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    // Upload directly to Firebase Storage
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file, {
        contentType: file.type,
    });

    // Get and return the download URL
    return getDownloadURL(storageRef);
}

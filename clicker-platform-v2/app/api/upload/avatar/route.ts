import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// Map MIME types to file extensions
const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

export async function POST(req: NextRequest) {
    try {
        console.log('[Upload Avatar] Starting upload process...');
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            console.warn('[Upload Avatar] No file provided');
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const allowedTypes = Object.keys(MIME_TO_EXT);
        if (!allowedTypes.includes(file.type)) {
            console.warn('[Upload Avatar] Invalid file type:', file.type);
            return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            console.warn('[Upload Avatar] File size too large:', file.size);
            return NextResponse.json({ error: 'File size too large (max 5MB)' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        console.log('[Upload Avatar] Storage bucket:', bucketName);

        if (!bucketName) {
            console.error('[Upload Avatar] Error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not defined');
            return NextResponse.json({ error: 'Server configuration error: Missing storage bucket' }, { status: 500 });
        }

        const bucket = adminStorage.bucket(bucketName);

        // Site-aware isolation
        const siteId = req.headers.get('x-site-id') || 'platform';
        const storagePrefix = siteId === 'platform' ? 'profile' : `sites/${siteId}/profile`;

        const ext = MIME_TO_EXT[file.type] || 'jpg';
        const fileName = `${storagePrefix}/avatar_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const fileRef = bucket.file(fileName);

        // Generate a unique token for the download URL
        const downloadToken = uuidv4();

        console.log('[Upload Avatar] Saving to:', fileName);
        await fileRef.save(buffer, {
            metadata: {
                contentType: file.type,
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken
                }
            },
        });

        // Construct the Firebase Storage Download URL
        const encodedPath = encodeURIComponent(fileName);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        console.log('[Upload Avatar] Success! URL:', publicUrl);
        return NextResponse.json({ url: publicUrl });

    } catch (error) {
        console.error('[Upload Avatar] FATAL ERROR:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

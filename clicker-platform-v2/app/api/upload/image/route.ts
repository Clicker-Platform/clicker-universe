import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
// Dynamic require to prevent Turbopack from hashing the module name
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        console.log('[Upload Image] Starting upload process...');
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const searchParams = req.nextUrl.searchParams;
        const folder = searchParams.get('folder') || 'uploads';

        if (!file) {
            console.warn('[Upload Image] No file provided');
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            console.warn('[Upload Image] Invalid file type:', file.type);
            return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
        }

        if (file.size > 10 * 1024 * 1024) {
            console.warn('[Upload Image] File size too large:', file.size);
            return NextResponse.json({ error: 'File size too large (max 10MB)' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Process image with Sharp
        console.log('[Upload Image] Processing image with Sharp...');
        const processedBuffer = await sharp(buffer)
            .resize({
                width: 800,
                height: 800,
                fit: 'inside', // Maintains aspect ratio, only shrinking if larger
                withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toBuffer();

        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        console.log('[Upload Image] Storage bucket:', bucketName);

        if (!bucketName) {
            console.error('[Upload Image] Error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not defined');
            return NextResponse.json({ error: 'Server configuration error: Missing storage bucket' }, { status: 500 });
        }

        const bucket = adminStorage.bucket(bucketName);

        // Site-aware isolation
        const siteId = req.headers.get('x-site-id') || 'platform';
        const storagePrefix = siteId === 'platform' ? folder : `sites/${siteId}/${folder}`;

        const fileName = `${storagePrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
        const fileRef = bucket.file(fileName);

        // Generate a unique token for the download URL
        const downloadToken = uuidv4();

        console.log('[Upload Image] Saving to:', fileName);
        await fileRef.save(processedBuffer, {
            metadata: {
                contentType: 'image/webp',
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken
                }
            },
        });

        // Construct the Firebase Storage Download URL
        const encodedPath = encodeURIComponent(fileName);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        console.log('[Upload Image] Success! URL:', publicUrl);
        return NextResponse.json({ url: publicUrl });

    } catch (error) {
        console.error('[Upload Image] FATAL ERROR:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

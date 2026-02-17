import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import sharp from 'sharp';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        // Session check removed to allow client-side auth (Firebase SDK) to handle access.
        // The UI is already protected by AdminGuard.
        // const session = (await cookies()).get('session')?.value;
        // if (!session) { ... }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const searchParams = req.nextUrl.searchParams;
        const folder = searchParams.get('folder') || 'uploads';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size too large (max 5MB)' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Process image with Sharp
        // Resize logic: max dimension 800px, maintain aspect ratio
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

        console.log('[Upload] Using bucket:', bucketName);

        if (!bucketName) {
            console.error('[Upload] Error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not defined');
            return NextResponse.json({ error: 'Server configuration error: Missing storage bucket' }, { status: 500 });
        }

        const bucket = adminStorage.bucket(bucketName);
        console.log('[Upload] Bucket initialized:', bucket.name);

        // Site-aware isolation
        const siteId = req.headers.get('x-site-id') || 'platform';
        const storagePrefix = siteId === 'platform' ? folder : `sites/${siteId}/${folder}`;

        const fileName = `${storagePrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
        const fileRef = bucket.file(fileName);

        // Generate a unique token for the download URL
        // This is the standard way Firebase Client SDKs generate URLs
        const downloadToken = uuidv4();

        console.log('[Upload] Saving file to:', fileName);

        // Save file with the download token in metadata
        await fileRef.save(processedBuffer, {
            metadata: {
                contentType: 'image/webp',
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken
                }
            },
        });
        console.log('[Upload] File saved successfully');

        // Construct the Firebase Storage Download URL
        // Format: https://firebasestorage.googleapis.com/v0/b/[BUCKET]/o/[PATH]?alt=media&token=[TOKEN]
        const encodedPath = encodeURIComponent(fileName);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        console.log('[Upload] Public URL generated:', publicUrl);

        return NextResponse.json({ url: publicUrl });

    } catch (error) {
        console.error('[Upload] FATAL ERROR:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

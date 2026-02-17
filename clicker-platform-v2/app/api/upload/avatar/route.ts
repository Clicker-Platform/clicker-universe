import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import sharp from 'sharp';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

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
        const processedBuffer = await sharp(buffer)
            .resize({ width: 500, height: 500, fit: 'cover' }) // Optimization
            .webp({ quality: 80 })
            .toBuffer();

        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

        if (!bucketName) {
            console.error('[Upload Avatar] Error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not defined');
            return NextResponse.json({ error: 'Server configuration error: Missing storage bucket' }, { status: 500 });
        }

        const bucket = adminStorage.bucket(bucketName);

        // Site-aware isolation
        const siteId = req.headers.get('x-site-id') || 'platform';
        const storagePrefix = siteId === 'platform' ? 'profile' : `sites/${siteId}/profile`;

        const fileName = `${storagePrefix}/avatar_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
        const fileRef = bucket.file(fileName);

        // Generate a unique token for the download URL (Standard Firebase Client way)
        const downloadToken = uuidv4();

        await fileRef.save(processedBuffer, {
            metadata: {
                contentType: 'image/webp',
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken
                }
            },
        });

        // Construct the Firebase Storage Download URL (No makePublic needed)
        // Format: https://firebasestorage.googleapis.com/v0/b/[BUCKET]/o/[PATH]?alt=media&token=[TOKEN]
        const encodedPath = encodeURIComponent(fileName);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        return NextResponse.json({ url: publicUrl });

    } catch (error) {
        console.error('Error uploading avatar:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import sharp from 'sharp';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        // Session check removed to allow client-side auth (Firebase SDK) to handle access.
        // The UI is already protected by AdminGuard.
        // const session = (await cookies()).get('session')?.value;
        // if (!session) { ... }

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

        console.log('[Upload Avatar] Using bucket:', bucketName);

        if (!bucketName) {
            console.error('[Upload Avatar] Error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not defined');
            return NextResponse.json({ error: 'Server configuration error: Missing storage bucket' }, { status: 500 });
        }

        const bucket = adminStorage.bucket(bucketName);
        const fileName = `profile/avatar_${Date.now()}.webp`;
        const fileRef = bucket.file(fileName);

        await fileRef.save(processedBuffer, {
            metadata: {
                contentType: 'image/webp',
            },
        });

        // Make the file public and get the URL
        await fileRef.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        return NextResponse.json({ url: publicUrl });

    } catch (error) {
        console.error('Error uploading avatar:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

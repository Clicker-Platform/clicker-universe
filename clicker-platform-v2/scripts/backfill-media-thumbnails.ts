#!/usr/bin/env tsx
/**
 * Backfill thumbnailUrl + thumbnailStoragePath on existing mediaLibrary records.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-media-thumbnails.ts <siteId>
 *   pnpm tsx scripts/backfill-media-thumbnails.ts --all
 *
 * Pulls each full image via its Storage path, resizes via sharp (longest edge <= 600px),
 * uploads alongside as `<basename>_thumb.webp`, and patches the doc.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import * as fs from 'fs';

// Manual env loader (matches test-storage.ts convention)
function loadEnv(filePath: string) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error loading', filePath + ':', e);
    }
}

loadEnv('.env');
loadEnv('.env.local');

function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const serviceAccountKeyPath = process.env.GCP_SERVICE_ACCOUNT_KEY;

    if (!bucketName) {
        console.error('ERROR: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing.');
        process.exit(1);
    }

    const config: any = { projectId, storageBucket: bucketName };

    if (serviceAccountKeyPath) {
        try {
            let credential;
            if (fs.existsSync(serviceAccountKeyPath)) {
                console.log(`Reading credentials from file: ${serviceAccountKeyPath}`);
                const fileContent = fs.readFileSync(serviceAccountKeyPath, 'utf8');
                credential = JSON.parse(fileContent);
            } else {
                console.log('Parsing credentials from env var...');
                credential = JSON.parse(serviceAccountKeyPath);
            }
            config.credential = cert(credential);
        } catch (e: any) {
            console.error('Failed to parse service account:', e.message);
            process.exit(1);
        }
    } else {
        console.warn('GCP_SERVICE_ACCOUNT_KEY not found. Attempting default init (ADC)...');
    }

    return initializeApp(config);
}

initializeAdmin();

const THUMB_MAX_EDGE = 600;
const THUMB_QUALITY = 80;

interface MediaItemDoc {
    id: string;
    url: string;
    storagePath: string;
    thumbnailUrl?: string;
    thumbnailStoragePath?: string;
    fileName: string;
    mimeType: string;
}

async function processSite(siteId: string): Promise<{ processed: number; skipped: number; failed: number }> {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const colRef = db.collection('sites').doc(siteId).collection('mediaLibrary');
    const snap = await colRef.get();

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of snap.docs) {
        const item = doc.data() as MediaItemDoc;
        if (item.thumbnailUrl) {
            skipped++;
            continue;
        }
        if (!item.mimeType?.startsWith('image/') || item.mimeType === 'image/svg+xml') {
            skipped++;
            continue;
        }
        if (!item.storagePath) {
            skipped++;
            continue;
        }

        try {
            const file = bucket.file(item.storagePath);
            const [buffer] = await file.download();
            const thumb = await sharp(buffer)
                // Fit inside a THUMB_MAX_EDGE x THUMB_MAX_EDGE box, preserving aspect.
                // Caps the longest edge regardless of orientation.
                .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: THUMB_QUALITY })
                .toBuffer();

            const thumbPath = item.storagePath.replace(/\.([^.]+)$/, '_thumb.webp');
            const thumbFile = bucket.file(thumbPath);
            await thumbFile.save(thumb, { contentType: 'image/webp' });
            await thumbFile.makePublic().catch(() => undefined);
            const [signedUrl] = await thumbFile.getSignedUrl({ action: 'read', expires: '2099-01-01' });

            await doc.ref.update({
                thumbnailUrl: signedUrl,
                thumbnailStoragePath: thumbPath,
            });
            processed++;
            console.log(`  OK  ${siteId}/${doc.id} (${item.fileName})`);
        } catch (err) {
            failed++;
            console.error(`  ERR ${siteId}/${doc.id}:`, err);
        }
    }
    return { processed, skipped, failed };
}

async function main() {
    const arg = process.argv[2];
    if (!arg) {
        console.error('Usage: tsx backfill-media-thumbnails.ts <siteId> | --all');
        process.exit(1);
    }

    const db = getFirestore();
    const siteIds = arg === '--all'
        ? (await db.collection('sites').listDocuments()).map(d => d.id)
        : [arg];

    const totals = { processed: 0, skipped: 0, failed: 0 };
    for (const siteId of siteIds) {
        console.log(`\n-- Site: ${siteId} --`);
        const r = await processSite(siteId);
        totals.processed += r.processed;
        totals.skipped += r.skipped;
        totals.failed += r.failed;
    }
    console.log(`\nDone. processed=${totals.processed} skipped=${totals.skipped} failed=${totals.failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });

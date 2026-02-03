
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

// Manual Env Parser
function loadEnv(filePath: string) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
        }
    } catch (e) {
        console.error(`Error loading ${filePath}:`, e);
    }
}

// Load env vars
loadEnv('.env');
loadEnv('.env.local');

async function testStorage() {
    console.log('--- Firebase Storage Diagnostic Script ---');

    // 1. Check Params
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const serviceAccount = process.env.GCP_SERVICE_ACCOUNT_KEY;

    console.log(`Project ID: ${projectId}`);
    console.log(`Bucket Name: ${bucketName}`);
    console.log(`Service Account Key Present: ${serviceAccount ? 'YES (Length: ' + serviceAccount.length + ')' : 'NO (Using ADC)'}`);

    if (!bucketName) {
        console.error('ERROR: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing.');
        process.exit(1);
    }

    // 2. Initialize
    try {
        if (!getApps().length) {
            const config: any = {
                projectId,
                storageBucket: bucketName
            };

            if (serviceAccount) {
                try {
                    config.credential = cert(JSON.parse(serviceAccount));
                    console.log('Initializing with Service Account Key...');
                } catch (e: any) {
                    console.error('Failed to parse service account key:', e.message);
                }
            } else {
                console.log('Initializing with ADC...');
            }

            initializeApp(config);
        }
    } catch (error: any) {
        console.error('Initialization Failed:', error.message);
        process.exit(1);
    }

    // 3. Test Write
    try {
        const bucket = getStorage().bucket(bucketName);
        console.log(`Attempting to write to bucket: ${bucket.name}...`);

        const file = bucket.file(`test_diagnostic_${Date.now()}.txt`);
        await file.save('Hello from diagnostic script!');

        console.log('SUCCESS: Write operation completed.');

        // 4. Test Public URL (optional for private buckets but good for verification)
        await file.makePublic();
        console.log(`SUCCESS: File made public. URL: https://storage.googleapis.com/${bucket.name}/${file.name}`);

        // Cleanup
        await file.delete();
        console.log('SUCCESS: Cleanup completed.');

    } catch (error: any) {
        console.error('\n!!! OPERATION FAILED !!!');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        if (error.errors) console.error('Details:', JSON.stringify(error.errors, null, 2));
    }
}

testStorage();


import { NextResponse } from 'next/server';
import { adminApp, adminAuth } from '@/lib/firebase-admin';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getApps = () => require('firebase-admin').apps || [];
import { cookies } from 'next/headers';

export async function GET() {
    // Block access in production environment
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    // Set a test cookie to verify persistence
    (await cookies()).set('debug_test_cookie', 'hello_world_' + Date.now(), {
        path: '/',
        maxAge: 3600,
        secure: true,
        sameSite: 'lax',
        httpOnly: false // Allow client JS to see it for debugging
    });

    try {
        const apps = getApps().map((a: any) => a.name);
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const envKey = process.env.GCP_SERVICE_ACCOUNT_KEY ? 'Present (Length ' + process.env.GCP_SERVICE_ACCOUNT_KEY.length + ')' : 'Missing';

        let authStatus = 'Unknown';
        let tokenTest = 'Not Attempted';
        try {
            // Basic check if auth service is usable
            if (adminAuth) {
                authStatus = 'Initialized';
                // Try signing a token to verify Credential Private Key is working
                await adminAuth.createCustomToken('test-health-check');
                tokenTest = 'Success: keys are valid';
            }
        } catch (e: any) {
            authStatus = 'Error: ' + e.message;
            tokenTest = 'Failed: ' + e.message;
        }

        return NextResponse.json({
            status: 'ok',
            apps,
            projectId,
            envKey,
            adminAppDefined: !!adminApp,
            adminAppName: adminApp?.name,
            authStatus,
            tokenTest,
            nodeEnv: process.env.NODE_ENV
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}

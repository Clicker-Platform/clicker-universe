
import { NextResponse } from 'next/server';
import { adminApp, adminAuth, firebaseAdmin } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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
        const apps = (firebaseAdmin.apps || []).map((a) => a?.name ?? '');
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
        } catch (e: unknown) {
            const eMsg = e instanceof Error ? e.message : String(e);
            authStatus = 'Error: ' + eMsg;
            tokenTest = 'Failed: ' + eMsg;
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
    } catch (error: unknown) {
        return NextResponse.json({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}

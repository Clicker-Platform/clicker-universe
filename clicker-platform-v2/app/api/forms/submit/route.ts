import { adminDb } from '@/lib/firebase-admin';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FieldValue } = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { formId, formTitle, data, siteId } = body;

        if (!siteId) {
            // Fallback or Error. For now, let's error to enforce tenant isolation.
            // Or we could write to global 'submissions' but Admin won't see it.
            console.warn('Missing siteId in form submission');
            return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
        }

        const collectionPath = `sites/${siteId}/inbox`;

        await adminDb.collection(collectionPath).add({
            formId,
            formTitle,
            data,
            submittedAt: FieldValue.serverTimestamp(),
            status: 'new'
        });

        // Email notification logic will be handled by Firebase Functions trigger
        // watching the 'inbox' collection.

        // --- Sales Pipeline Integration (Strict Modularity) ---
        // Dynamically import to avoid hard dependency using existing module check if possible
        // Since we don't have a server-side module registry check easily available without generic DB read,
        // we will just try the dynamic import and fail silently if module not present or logic fails,
        // or check simple flag. For now, try/catch around the hook is safest and cleanest.
        try {
            const { handleNewSubmission } = await import('@/lib/modules/sales-pipeline/server-integration');
            // The function itself handles config checks, so just call it.
            await handleNewSubmission(formId, data);
        } catch (e) {
            // Module might not exist or code not loaded for some reason (e.g. tree shaking if not used elsewhere, though unlikely here)
            // or just not implemented. Ignore or log debug.
            // console.log('Sales Pipeline hook not executed:', e); 
        }
        // -----------------------------------------------------

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Submission error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

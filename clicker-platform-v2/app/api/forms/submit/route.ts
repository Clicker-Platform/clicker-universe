import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { formId, formTitle, data, siteId, fieldLabels } = body;

        if (!siteId) {
            console.warn('Missing siteId in form submission');
            return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
        }

        // Write submission to site-scoped inbox (Firestore rules allow public create)
        await addDoc(collection(db, 'sites', siteId, 'inbox'), {
            formId,
            formTitle,
            data,
            submittedAt: serverTimestamp(),
            status: 'new'
        });

        // Email notification — fetch form to get emailNotificationTo
        try {
            const formDoc = await getDoc(doc(db, 'sites', siteId, 'forms', formId));
            if (formDoc.exists()) {
                const emailTo = formDoc.data()?.emailNotificationTo;
                console.log('[forms/submit] emailNotificationTo:', emailTo ?? '(not set)');
                if (emailTo) {
                    const { sendFormNotification } = await import('@/lib/email');
                    await sendFormNotification(emailTo, formTitle, data, fieldLabels);
                    console.log('[forms/submit] Email sent to:', emailTo);
                }
            } else {
                console.warn('[forms/submit] Form doc not found:', formId);
            }
        } catch (emailError) {
            // Email failure should not block the submission
            console.error('[forms/submit] Email notification failed:', emailError);
        }

        // Sales Pipeline Integration (modular — fails silently if not configured)
        try {
            const { handleNewSubmission } = await import('@/lib/modules/sales-pipeline/server-integration');
            await handleNewSubmission(formId, data);
        } catch {
            // Module not installed or not configured — ignore
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Submission error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

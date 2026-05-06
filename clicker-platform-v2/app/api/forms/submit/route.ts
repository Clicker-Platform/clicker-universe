import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    let siteId: string | undefined;
    let formId: string | undefined;
    try {
        const body = await request.json();
        ({ formId } = body);
        const { formTitle, data, fieldLabels } = body;
        siteId = body.siteId;

        if (!siteId) {
            logger.warn('form.siteId.missing', { siteId: 'platform' });
            return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
        }

        // Write submission to site-scoped inbox (Admin SDK bypasses Firestore rules)
        await adminDb.collection('sites').doc(siteId).collection('inbox').add({
            formId,
            formTitle,
            data,
            submittedAt: FieldValue.serverTimestamp(),
            status: 'new'
        });

        // Email notification — fetch form to get emailNotificationTo
        try {
            if (!formId) throw new Error('formId missing');
            const formDoc = await adminDb.collection('sites').doc(siteId).collection('forms').doc(formId).get();
            if (formDoc.exists) {
                const emailTo = formDoc.data()?.emailNotificationTo;
                if (emailTo) {
                    const { sendEmail, FormSubmission } = await import('@/lib/email');
                    const { createElement } = await import('react');
                    await sendEmail({
                        to: emailTo,
                        siteId,
                        subject: `New submission: ${formTitle}`,
                        template: createElement(FormSubmission, { formTitle, data, fieldLabels }),
                        tags: [
                            { name: 'module', value: 'core_crm' },
                            { name: 'template', value: 'form-submission' },
                        ],
                    });
                }
            } else {
                logger.warn('form.not.found', { siteId, formId });
            }
        } catch (emailError) {
            // Email failure should not block the submission
            logger.warn('form.email.notify.failed', { siteId, error: emailError });
        }

        // Sales Pipeline Integration (modular — fails silently if not configured)
        try {
            const { handleNewSubmission } = await import('@/lib/modules/sales-pipeline/server-integration');
            await handleNewSubmission(siteId, formId ?? '', data);
        } catch {
            // Module not installed or not configured — ignore
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('form.submit.failed', { siteId, formId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

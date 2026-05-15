import { adminDb } from '@/lib/firebase-admin';
import { PipelineConfig } from './types';
import { MODULE_ID, COLLECTION_LEADS } from './constants';
import { logger } from '@/lib/logger';

export async function handleNewSubmission(siteId: string, formId: string, submissionData: Record<string, unknown>) {

    try {
        // 1. Fetch Pipeline Configuration (per-tenant path)
        const configDoc = await adminDb
            .collection('sites')
            .doc(siteId)
            .collection('modules')
            .doc(MODULE_ID)
            .collection('settings')
            .doc('config')
            .get();

        if (!configDoc.exists) return;

        const config = configDoc.data() as PipelineConfig;
        if (!config.formIntegrations || config.formIntegrations.length === 0) return;

        // 2. Find matching integration
        const integration = config.formIntegrations.find(i => i.formId === formId);
        if (!integration) return;


        // 3. Extract Data using Mapping
        const mapping = integration.fieldMapping;
        const name = submissionData[mapping.name] || 'Unknown';
        const contact = submissionData[mapping.contact] || 'No Contact';

        // Handle optional fields
        let source = 'Form Submission';
        if (mapping.source && submissionData[mapping.source]) {
            source = submissionData[mapping.source] as string;
        }

        // 4. Construct Notes from ALL other fields
        const notesParts: string[] = [`Submitted via form: ${formId}`];

        // Add explicitly mapped notes first if any
        if (mapping.notes && submissionData[mapping.notes]) {
            notesParts.push(submissionData[mapping.notes] as string);
        }

        // Add all other non-mapped fields to notes
        const mappedKeys = new Set([
            mapping.name,
            mapping.contact,
            mapping.source || '',
            mapping.notes || ''
        ]);

        const otherFields = Object.entries(submissionData)
            .filter(([key]) => !mappedKeys.has(key))
            .map(([key, value]) => `${key}: ${value}`);

        if (otherFields.length > 0) {
            notesParts.push('--- Submission Details ---');
            notesParts.push(...otherFields);
        }

        const notes = notesParts.join('\n');

        // 5. Create Lead in Firestore (using Admin SDK, per-tenant path)
        const now = Date.now();
        await adminDb.collection('sites').doc(siteId).collection('modules').doc(MODULE_ID).collection(COLLECTION_LEADS).add({
            name,
            contact,
            source,
            notes,
            stageId: integration.targetStageId,
            value: 0, // Default to 0, could be mapped if needed
            createdAt: now,
            updatedAt: now
        });

    } catch (error) {
        logger.error('pipeline.lead.create.failed', { siteId, error });
    }
}

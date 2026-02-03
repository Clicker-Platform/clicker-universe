import { adminDb } from '@/lib/firebase-admin';
import { FormIntegration, PipelineConfig } from './types';
import { MODULE_ID } from './constants';

export async function handleNewSubmission(formId: string, submissionData: any) {
    console.log(`[SalesPipeline] Checking integrations for form ${formId}`);

    try {
        // 1. Fetch Pipeline Configuration
        // Note: In a high-traffic production app, this should be cached.
        const configDoc = await adminDb
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

        console.log(`[SalesPipeline] Found integration for form ${formId}, creating lead...`);

        // 3. Extract Data using Mapping
        const mapping = integration.fieldMapping;
        const name = submissionData[mapping.name] || 'Unknown';
        const contact = submissionData[mapping.contact] || 'No Contact';

        // Handle optional fields
        let source = 'Form Submission';
        if (mapping.source && submissionData[mapping.source]) {
            source = submissionData[mapping.source];
        }

        // 4. Construct Notes from ALL other fields
        let notesParts: string[] = [`Submitted via form: ${formId}`];

        // Add explicitly mapped notes first if any
        if (mapping.notes && submissionData[mapping.notes]) {
            notesParts.push(submissionData[mapping.notes]);
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

        // 5. Create Lead in Firestore (using Admin SDK)
        const now = Date.now();
        await adminDb.collection('leads').add({
            name,
            contact,
            source,
            notes,
            stageId: integration.targetStageId,
            value: 0, // Default to 0, could be mapped if needed
            createdAt: now,
            updatedAt: now
        });

        console.log(`[SalesPipeline] Lead created successfully for form ${formId}`);

    } catch (error) {
        console.error('[SalesPipeline] Error handling form submission:', error);
    }
}

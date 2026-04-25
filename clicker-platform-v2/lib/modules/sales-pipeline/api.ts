import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    Unsubscribe,
    setDoc,
    getDocs
} from 'firebase/firestore';
import { Lead, PipelineConfig } from './types';
import { DEFAULT_PIPELINE_STAGES, MODULE_ID, COLLECTION_LEADS } from './constants';

// --- Configuration ---

export async function getPipelineConfig(siteId: string): Promise<PipelineConfig> {
    try {
        const configRef = doc(db, 'sites', siteId, 'modules', MODULE_ID, 'settings', 'config');
        const snap = await getDoc(configRef);

        if (snap.exists()) {
            // Return Default if stages missing, but preserve integrations if any
            const data = snap.data() as PipelineConfig;
            if (!data.stages) return { ...data, stages: DEFAULT_PIPELINE_STAGES };
            return data;
        }
    } catch (error) {
        logger.error('pipeline.board.fetch.failed', { siteId, error });
    }
    return { stages: DEFAULT_PIPELINE_STAGES };
}

export async function savePipelineConfig(siteId: string, config: PipelineConfig): Promise<void> {
    const configRef = doc(db, 'sites', siteId, 'modules', MODULE_ID, 'settings', 'config');
    // Ensure module doc exists first (optional but good practice, though subcollection writes usually work)
    await setDoc(configRef, config, { merge: true });
}

// --- Forms Helper (Strict Modularity: Read Only Public Collection) ---
export async function getAvailableForms(siteId: string): Promise<{ id: string, title: string, fields: { id: string, label: string }[] }[]> {
    try {
        const formsCol = collection(db, 'sites', siteId, 'forms');
        // We fetching full docs anyway, might as well return the fields structure for mapping
        const snap = await getDocs(query(formsCol, orderBy('title', 'asc')));
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || 'Untitled Form',
                fields: Array.isArray(data.fields) ? data.fields.map((f: any) => ({
                    id: f.id,
                    label: f.label
                })) : []
            };
        });
    } catch (error) {
        logger.error('pipeline.board.fetch.failed', { siteId, error });
        return [];
    }
}

// --- Leads ---

function leadsCol(siteId: string) {
    return collection(db, 'sites', siteId, 'modules', MODULE_ID, COLLECTION_LEADS);
}

function leadDoc(siteId: string, leadId: string) {
    return doc(db, 'sites', siteId, 'modules', MODULE_ID, COLLECTION_LEADS, leadId);
}

export function subscribeToLeads(siteId: string, callback: (leads: Lead[]) => void, limitCount: number = 100): Unsubscribe {
    const q = query(leadsCol(siteId), orderBy('updatedAt', 'desc'), limit(limitCount));

    return onSnapshot(q, (snapshot) => {
        const leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Lead[];
        callback(leads);
    }, (error) => {
        logger.error('pipeline.lead.create.failed', { siteId, error });
        callback([]);
    });
}

export async function createLead(siteId: string, leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const docRef = await addDoc(leadsCol(siteId), {
        ...leadData,
        createdAt: now,
        updatedAt: now
    });
    return docRef.id;
}

export async function updateLeadStage(siteId: string, leadId: string, stageId: string): Promise<void> {
    await updateDoc(leadDoc(siteId, leadId), {
        stageId,
        updatedAt: Date.now()
    });
}

export async function updateLead(siteId: string, leadId: string, updates: Partial<Lead>): Promise<void> {
    // Prevent overwriting immutable fields if accidentally passed
    const { id, createdAt, ...safeUpdates } = updates;

    await updateDoc(leadDoc(siteId, leadId), {
        ...safeUpdates,
        updatedAt: Date.now()
    });
}

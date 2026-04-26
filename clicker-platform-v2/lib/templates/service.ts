import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    Timestamp,
    deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { TemplateDocument, TemplateDefinition, ThemeConfig } from './types';
import { templateDefinitions } from './definitions';

// Collection Reference
const TEMPLATES_COLLECTION = 'templates';

// In-memory cache with TTL
const templateCache = new Map<string, { data: TemplateDocument, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the template cache (useful after admin updates)
 */
export const clearTemplateCache = (id?: string) => {
    if (id) {
        templateCache.delete(id);
    } else {
        templateCache.clear();
    }
};

/**
 * Fetch all available templates for value selection (System + public/owned).
 * In MVP, since read rule is public, this gets all active templates.
 * We can filter client-side or assume all fetched are valid.
 */
export const getAvailableTemplates = async (): Promise<TemplateDocument[]> => {
    try {
        const q = query(collection(db, TEMPLATES_COLLECTION), where('status', '==', 'active'));
        const snapshot = await getDocs(q);

        const templates = snapshot.docs.map(doc => {
            const data = doc.data();
            const id = doc.id;
            // Provide fallback thumbnail if missing in DB
            const staticDef = templateDefinitions[id];
            return {
                id,
                ...data,
                thumbnailUrl: data.thumbnailUrl || staticDef?.thumbnailUrl || 'https://images.unsplash.com/photo-1550989460-d29b0a880056?q=80&w=600&auto=format&fit=crop'
            };
        }) as TemplateDocument[];

        // Combine with static definitions (System Templates)
        const systemTemplates = Object.values(templateDefinitions).map(def => ({
            id: def.id,
            name: def.name,
            description: def.description,
            type: 'system',
            tier: def.isPro ? 'premium' : 'free',
            status: 'active',
            config: def.config,
            thumbnailUrl: def.thumbnailUrl, // Assuming definition has it or we map it
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        } as TemplateDocument));

        // Merge: DB overrides System if IDs clash (though usually they shouldn't)
        // Or System first, then DB. 
        // Let's return System templates + DB templates that are NOT in System.
        const dbTemplateIds = new Set(templates.map(t => t.id));
        const newSystemTemplates = systemTemplates.filter(t => !dbTemplateIds.has(t.id));

        return [...newSystemTemplates, ...templates];
    } catch (error) {
        logger.error('template.fetch.failed', { siteId: 'platform', error });
        // Fallback to system templates only
        return Object.values(templateDefinitions).map(def => ({
            id: def.id,
            name: def.name,
            description: def.description,
            type: 'system',
            tier: def.isPro ? 'premium' : 'free',
            status: 'active',
            config: def.config,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        } as TemplateDocument));
    }
};

/**
 * Get a specific template by ID from Firestore.
 * Falls back to static definition if not found in DB (Hybrid approach).
 * Uses in-memory cache to reduce Firestore reads.
 */
export const fetchTemplate = async (id: string): Promise<TemplateDocument | null> => {
    // Check cache first
    const cached = templateCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const docRef = doc(db, TEMPLATES_COLLECTION, id);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const result = { id: snapshot.id, ...snapshot.data() } as TemplateDocument;
            // Cache the result
            templateCache.set(id, { data: result, timestamp: Date.now() });
            return result;
        }

        // Fallback to static definition for system templates if not yet seeded
        if (templateDefinitions[id]) {
            const staticDef = templateDefinitions[id];
            const result: TemplateDocument = {
                id: staticDef.id as string,
                name: staticDef.name,
                description: staticDef.description,
                thumbnailUrl: staticDef.thumbnailUrl,
                type: 'system',
                tier: staticDef.isPro ? 'premium' : 'free',
                status: 'active',
                config: staticDef.config,
                ownerId: null,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            // Cache static fallback too
            templateCache.set(id, { data: result, timestamp: Date.now() });
            return result;
        }

        return null;
    } catch (error) {
        logger.error('template.fetch.failed', { siteId: 'platform', error });
        return null;
    }
};

/**
 * Create or Update a template.
 */
export const saveTemplate = async (template: TemplateDocument): Promise<void> => {
    try {
        const docRef = doc(db, TEMPLATES_COLLECTION, template.id);
        const data = {
            ...template,
            updatedAt: Timestamp.now()
        };

        // If it's a new doc, set createdAt
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            data.createdAt = Timestamp.now();
        }

        await setDoc(docRef, data, { merge: true });
    } catch (error) {
        logger.error('template.save.failed', { siteId: 'platform', error });
        throw error;
    }
};

/**
 * Delete a custom template
 */
export const deleteTemplate = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, TEMPLATES_COLLECTION, id));
    } catch (error) {
        logger.error('template.delete.failed', { siteId: 'platform', error });
        throw error;
    }
};

/**
 * Assign a template to the Business Profile.
 * This updates `content/profile` document.
 */
export const assignTemplateToProfile = async (templateId: string, customConfig?: Partial<ThemeConfig>): Promise<void> => {
    try {
        // Assume single profile at "content/profile" as per current app structure
        const profileRef = doc(db, 'content', 'profile');

        // We update the root fields or a nested object? 
        // Based on analysis, `templateId` is currently likely at root public data or page config.
        // But for future modularity we agreed on `theme` object in profile.
        // For MVP compatibility, we might need to update existing fields too if used.

        // Let's inspect how public data fetches it. 
        // fetchPublicData gets it from "settings/design" or "content/profile"?
        // Actually publicData is an aggregation. 
        // Docs said: publicData.templateId comes from somewhere.
        // Let's standardise on `content/profile` having a `templateConfig` field.

        await updateDoc(profileRef, {
            'templateConfig.activeTemplateId': templateId,
            'templateConfig.customConfig': customConfig || {},
            'updatedAt': Timestamp.now()
        });
    } catch (error) {
        logger.error('template.assign.failed', { siteId: 'platform', error });
        throw error;
    }
};

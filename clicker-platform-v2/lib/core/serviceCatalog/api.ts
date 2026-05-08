import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    deleteField,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ServiceCatalogItem, ServiceCategoryConfig, DEFAULT_SERVICE_CATEGORIES } from './types';

export const SERVICE_CATALOG = 'serviceCatalog';

// Recursively strips undefined values from plain objects (Firestore rejects undefined)
function stripUndefined<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, v !== null && typeof v === 'object' && !Array.isArray(v) ? stripUndefined(v) : v])
    ) as T;
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getServiceCatalog(
    siteId: string,
    opts: { activeOnly?: boolean } = {}
): Promise<ServiceCatalogItem[]> {
    const constraints = opts.activeOnly
        ? [where('outletId', '==', siteId), where('isActive', '==', true)]
        : [where('outletId', '==', siteId)];
    const q = query(collection(db, 'sites', siteId, SERVICE_CATALOG), ...constraints);
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceCatalogItem));
    return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getServiceCatalogItem(
    siteId: string,
    id: string
): Promise<ServiceCatalogItem | null> {
    const snap = await getDoc(doc(db, 'sites', siteId, SERVICE_CATALOG, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ServiceCatalogItem;
}

// ─── Write ─────────────────────────────────────────────────────────────────────

export async function createServiceCatalogItem(
    siteId: string,
    data: Omit<ServiceCatalogItem, 'id' | 'outletId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    const payload = stripUndefined({
        ...data,
        outletId: siteId,
        isActive: data.isActive ?? true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    const ref = await addDoc(collection(db, 'sites', siteId, SERVICE_CATALOG), payload);
    return ref.id;
}

export async function updateServiceCatalogItem(
    siteId: string,
    id: string,
    data: Partial<Omit<ServiceCatalogItem, 'id' | 'outletId' | 'createdAt'>>
): Promise<void> {
    // Top-level `undefined` means "clear this field" — convert to deleteField() so
    // Firestore actually removes it. Nested undefineds are still stripped.
    const cleaned: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        cleaned[k] = v === undefined
            ? deleteField()
            : (v !== null && typeof v === 'object' && !Array.isArray(v) ? stripUndefined(v) : v);
    }
    await updateDoc(doc(db, 'sites', siteId, SERVICE_CATALOG, id), cleaned);
}

export async function deleteServiceCatalogItem(siteId: string, id: string): Promise<void> {
    await deleteDoc(doc(db, 'sites', siteId, SERVICE_CATALOG, id));
}

// ─── Category Config ────────────────────────────────────────────────────────────
// Stored in settings/serviceCategories as { categories: ServiceCategoryConfig[] }

const CATEGORIES_DOC = 'settings/serviceCategories';

export async function getServiceCategories(siteId: string): Promise<ServiceCategoryConfig[]> {
    const snap = await getDoc(doc(db, 'sites', siteId, CATEGORIES_DOC));
    if (!snap.exists()) return DEFAULT_SERVICE_CATEGORIES;
    return (snap.data().categories as ServiceCategoryConfig[]) ?? DEFAULT_SERVICE_CATEGORIES;
}

export async function saveServiceCategories(siteId: string, categories: ServiceCategoryConfig[]): Promise<void> {
    await updateDoc(doc(db, 'sites', siteId, CATEGORIES_DOC), { categories }).catch(async () => {
        // Document doesn't exist yet — create it
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'sites', siteId, CATEGORIES_DOC), { categories });
    });
}

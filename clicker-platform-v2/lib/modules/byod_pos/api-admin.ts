import { adminDb } from '@/lib/firebase-admin';
import { POSOrder } from './types';

const ORDERS_COLLECTION = 'modules/byod_pos/orders';
const MENU_ITEMS_COLLECTION = 'modules/byod_pos/menu_items';

export async function getRecentOrdersAdmin(siteId: string): Promise<POSOrder[]> {
    const snapshot = await adminDb
        .collection('sites').doc(siteId).collection(ORDERS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        // Convert Admin Timestamp to client-compatible format (ISO string or number)
        // ideally we keep data strict, but for initial props we need to be careful with serialization
        // The calling page handles serialization, so we return raw objects here?
        // Admin SDK returns its own Timestamp object which is different from Client SDK Timestamp.
        // It's safer to let the Page component handle generic serialization (JSON.parse(JSON.stringify))
        // or explicitly convert here if needed. For now, returning objects is fine.
        return {
            id: doc.id,
            ...data
        } as unknown as POSOrder;
    });
}

// Re-defining interface here to avoid importing from client-side file if it causes issues,
// but usually type imports are fine.
interface POSItem {
    id: string;
    name: string;
    price: number;
    category: string;
    description?: string;
    imageUrl?: string;
    images?: string[];
    isActive?: boolean;
}

export async function getMenuItemsAdmin(siteId: string): Promise<POSItem[]> {
    const snapshot = await adminDb
        .collection('sites').doc(siteId).collection(MENU_ITEMS_COLLECTION)
        .orderBy('name')
        .get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || '',
            price: typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0,
            category: data.category || '',
            description: data.description || '',
            imageUrl: data.imageUrl || (data.images && data.images[0]) || '',
            images: data.images || [],
            isActive: data.isActive !== false
        };
    });
}

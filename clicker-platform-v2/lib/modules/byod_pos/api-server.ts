import { adminDb as db } from '@/lib/firebase-admin';
import { InventoryItem } from '@/lib/modules/inventory/types';
import { logger } from '@/lib/logger';

export async function getPOSDataServer(siteId: string) {
    try {
        // Parallel Fetching
        const [menuSnap, inventorySnap] = await Promise.all([
            db.collection('sites').doc(siteId).collection('modules/byod_pos/menu_items').orderBy('name').get(),
            db.collection('sites').doc(siteId).collection('modules/inventory/items').get()
        ]);

        // 1. Process Menu Items
        const items = menuSnap.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || '',
                    price: typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0,
                    category: data.category || '',
                    imageUrl: data.imageUrl || (data.images && data.images[0]) || '',
                    images: data.images || [],
                    isActive: data.isActive !== false
                };
            })
            // Manual filter since we might want to see all but UI hides inactive? 
            // The client filter was .filter(i => i.isActive). matching that.
            .filter(i => i.isActive);

        // 2. Process Inventory for Map
        const inventoryItems = inventorySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));

        const invByLink: Record<string, InventoryItem> = {};
        const invByName: Record<string, InventoryItem> = {};

        inventoryItems.forEach(invItem => {
            if (invItem.linkedPosItemId) invByLink[invItem.linkedPosItemId] = invItem;
            invByName[invItem.name] = invItem;
        });

        const inventoryMap: Record<string, InventoryItem> = {};
        items.forEach(posItem => {
            if (invByLink[posItem.id]) {
                inventoryMap[posItem.id] = invByLink[posItem.id];
            } else if (invByName[posItem.name]) {
                inventoryMap[posItem.id] = invByName[posItem.name];
            }
        });

        // Serialize for hydration (remove undefined, dates to strings if any)
        return {
            initialItems: JSON.parse(JSON.stringify(items)),
            initialInventoryMap: JSON.parse(JSON.stringify(inventoryMap))
        };
    } catch (e: unknown) {
        // Log warning but don't crash. If credentials missing, client-side fetch will take over.
        // Returning undefined (instead of empty array) triggers the client-side useEffect fallback.
        if (e instanceof Error && e.message?.includes('credentials')) {
            logger.warn('pos.server.fetch.skipped', { siteId, error: e });
        } else {
            logger.error('pos.server.fetch.failed', { siteId, error: e });
        }
        return { initialItems: undefined, initialInventoryMap: undefined };
    }
}

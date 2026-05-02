import {
    collection,
    doc,
    getDocs,
    getDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { InventoryItem, StockTransaction, TransactionReason } from './types';

const INVENTORY_COLLECTION = 'modules/inventory/items';
const TRANSACTIONS_COLLECTION = 'modules/inventory/transactions';

/**
 * Fetches all inventory items.
 */
export async function getInventory(siteId: string): Promise<InventoryItem[]> {
    if (!siteId || siteId === 'default' || siteId === 'pending') return [];

    // Client-side filter: exclude archived items. Using orderBy only avoids needing
    // a composite index on [archivedAt, name] for the common case of no archived items.
    const q = query(
        collection(db, 'sites', siteId, INVENTORY_COLLECTION),
        orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem))
        .filter(item => !item.archivedAt);
}

/**
 * Fetches a single inventory item by ID.
 */
export async function getInventoryItem(siteId: string, id: string): Promise<InventoryItem | null> {
    if (!siteId || siteId === 'default' || siteId === 'pending') return null;

    const docRef = doc(db, 'sites', siteId, INVENTORY_COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as InventoryItem;
}

/**
 * Creates a new inventory item. If initialStock > 0, writes an opening balance
 * transaction so stock history starts clean from day one.
 */
export async function createInventoryItem(siteId: string, data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<string> {
    const user = auth.currentUser;
    const itemsCol = collection(db, 'sites', siteId, INVENTORY_COLLECTION);
    const txCol = collection(db, 'sites', siteId, TRANSACTIONS_COLLECTION);

    const itemRef = doc(itemsCol);
    await runTransaction(db, async (transaction) => {
        transaction.set(itemRef, {
            ...data,
            archivedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        if (data.currentStock > 0) {
            transaction.set(doc(txCol), {
                itemId: itemRef.id,
                itemName: data.name,
                change: data.currentStock,
                reason: 'adjustment' as TransactionReason,
                referenceId: null,
                notes: 'Opening balance',
                performedBy: user?.email || 'System',
                timestamp: Timestamp.now()
            });
        }
    });

    return itemRef.id;
}

/**
 * Soft-deletes an inventory item by setting archivedAt.
 * Transaction history is preserved.
 */
export async function archiveInventoryItem(siteId: string, itemId: string): Promise<void> {
    const itemRef = doc(db, 'sites', siteId, INVENTORY_COLLECTION, itemId);
    await updateDoc(itemRef, { archivedAt: serverTimestamp() });
}

/**
 * Updates stock level transactionally.
 * Records the change in a separate transactions collection.
 */
export async function updateStock(
    siteId: string,
    itemId: string,
    change: number,
    reason: TransactionReason,
    referenceId?: string,
    notes?: string
): Promise<void> {
    const itemRef = doc(db, 'sites', siteId, INVENTORY_COLLECTION, itemId);
    const transactionRef = collection(db, 'sites', siteId, TRANSACTIONS_COLLECTION);
    const user = auth.currentUser;

    await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
            throw new Error("Item does not exist!");
        }

        const currentStock = itemDoc.data().currentStock || 0;
        const newStock = currentStock + change;
        const itemName = itemDoc.data().name;

        // 1. Update the item's stock
        transaction.update(itemRef, {
            currentStock: newStock,
            updatedAt: serverTimestamp()
        });

        // 2. Create a transaction record
        const newTransactionRef = doc(transactionRef); // Auto-ID
        transaction.set(newTransactionRef, {
            itemId,
            itemName,
            change,
            reason,
            referenceId: referenceId ?? null,
            notes: notes ?? null,
            performedBy: user?.email || 'System',
            timestamp: Timestamp.now()
        });
    });
}

/**
 * Fetches transaction history for a specific inventory item.
 */
export async function getInventoryTransactions(siteId: string, itemId: string): Promise<StockTransaction[]> {
    if (!siteId || siteId === 'default' || siteId === 'pending') return [];

    const q = query(
        collection(db, 'sites', siteId, TRANSACTIONS_COLLECTION),
        where('itemId', '==', itemId),
        orderBy('timestamp', 'desc')
    );

    // Note: This query requires a composite index on [itemId, timestamp DESC].
    // If it fails, check the console for the index creation link.

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as StockTransaction));
}

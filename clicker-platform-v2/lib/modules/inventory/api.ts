import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
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
    const q = query(collection(db, 'sites', siteId, INVENTORY_COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as InventoryItem));
}

/**
 * Fetches a single inventory item by ID.
 */
export async function getInventoryItem(siteId: string, id: string): Promise<InventoryItem | null> {
    const docRef = doc(db, 'sites', siteId, INVENTORY_COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as InventoryItem;
}

/**
 * Creates a new inventory item.
 */
export async function createInventoryItem(siteId: string, data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'sites', siteId, INVENTORY_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
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
        const stockTransaction: Omit<StockTransaction, 'id'> = {
            itemId,
            itemName,
            change,
            reason,
            referenceId: referenceId || undefined,
            notes: notes || undefined,
            performedBy: user?.email || 'System',
            timestamp: Timestamp.now()
        };

        transaction.set(newTransactionRef, stockTransaction);
    });
}

/**
 * Fetches transaction history for a specific inventory item.
 */
export async function getInventoryTransactions(siteId: string, itemId: string): Promise<StockTransaction[]> {
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

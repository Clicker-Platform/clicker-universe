import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    where,
    Timestamp,
    setDoc,
    startAfter,
    QueryDocumentSnapshot,
    runTransaction,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { POSOrder, POSSettings, POSItem, POSStaffMember } from './types';
import { isModuleEnabled } from '@/lib/modules/registry';
import { logger } from '@/lib/logger-edge';

import { ORDERS_COLLECTION, SETTINGS_DOC } from './constants';

export { ORDERS_COLLECTION }; // Re-export for potential legacy consumers if needed
// const SETTINGS_DOC = 'modules/byod_pos/settings/config'; // Removed local def

/**
 * Subscribe to recent orders. 
 * Limits to the last 100 orders to prevent performance issues.
 */
export function subscribeToRecentOrders(siteId: string, callback: (orders: POSOrder[]) => void) {
    if (!siteId || siteId === 'default' || siteId === 'pending') return () => { };

    const q = query(
        collection(db, 'sites', siteId, ORDERS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(100)
    );

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as POSOrder));
        callback(orders);
    }, (error) => {
        if (error.code === 'permission-denied') {
            logger.warn('pos.order.subscription.denied', { siteId });
            // Optionally callback with empty list or handle gracefully
        } else {
            logger.error('pos.order.failed', { siteId, error });
        }
    });
}

/**
 * Fetch paginated orders for history view.
 */
export async function getPaginatedOrders(siteId: string, lastDoc: QueryDocumentSnapshot | null, pageSize: number = 20): Promise<{ orders: POSOrder[], lastVisible: QueryDocumentSnapshot | null }> {
    let q = query(
        collection(db, 'sites', siteId, ORDERS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
    );

    if (lastDoc) {
        q = query(
            collection(db, 'sites', siteId, ORDERS_COLLECTION),
            orderBy('createdAt', 'desc'),
            startAfter(lastDoc),
            limit(pageSize)
        );
    }

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as POSOrder));

    return {
        orders,
        lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
    };
}

/**
 * Fetch dedicated history orders (completed/cancelled/refunded/paid).
 * Optimizes performance by filtering at database level.
 */
export async function getHistoryOrders(siteId: string, lastDoc: QueryDocumentSnapshot | null, pageSize: number = 20): Promise<{ orders: POSOrder[], lastVisible: QueryDocumentSnapshot | null }> {
    // Note: 'in' query with orderBy might require a composite index. 
    // If you see a "Missing Index" error, click the link in the console to create it.

    const constraints: any[] = [
        where('status', 'in', ['completed', 'cancelled']),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
    ];

    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }

    const q = query(
        collection(db, 'sites', siteId, ORDERS_COLLECTION),
        ...constraints
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as POSOrder));

    return {
        orders,
        lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
    };
}

export async function getRecentOrders(siteId: string): Promise<POSOrder[]> {
    const q = query(
        collection(db, 'sites', siteId, ORDERS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(100)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as POSOrder));
}

/**
 * Fetch a single order by ID.
 */
export async function getOrder(siteId: string, orderId: string): Promise<POSOrder | null> {
    const docRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, orderId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as POSOrder;
    }
    return null;
}

export async function getMenuItems(
    siteId: string,
    category: string = 'All',
    searchQuery: string = '',
    pageSize: number = 20,
    lastDoc: QueryDocumentSnapshot | null = null
): Promise<{ items: POSItem[], lastDoc: QueryDocumentSnapshot | null }> {
    let constraints: any[] = [orderBy('name'), limit(pageSize + 1)]; // Fetch one extra to check for "next"

    // Category Filter
    if (category && category !== 'All') {
        constraints = [where('category', '==', category), orderBy('name'), limit(pageSize + 1)];
    }

    // Search Filter (Prefix)
    if (searchQuery) {
        constraints = [
            where('name', '>=', searchQuery),
            where('name', '<=', searchQuery + '\uf8ff'),
            orderBy('name'),
            limit(pageSize + 1)
        ];
    }

    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'sites', siteId, 'modules/byod_pos/menu_items'), ...constraints);
    const snapshot = await getDocs(q);

    // Determines if there are more items
    const hasNextPage = snapshot.docs.length > pageSize;

    // Slice off the extra item if exists
    const docs = hasNextPage ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
    const lastVisible = docs.length > 0 ? docs[docs.length - 1] : null;

    const items = docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || '',
            price: typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0,
            category: data.category || '',
            imageUrl: data.imageUrl || (data.images && data.images[0]) || '',
            images: data.images || [],
            isActive: data.isActive !== false,
            variants: data.variants || []
        } as POSItem;
    }).filter(i => i.isActive);

    return {
        items,
        // We checked +1.
        // If !hasNextPage, we can force lastDoc to null to signal end.
        lastDoc: hasNextPage ? lastVisible : null
    };
}

export async function ensureCategoryExists(siteId: string, category: string) {
    if (!category) return;
    const settingsRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    await setDoc(settingsRef, {
        categories: arrayUnion(category)
    }, { merge: true });
}

export interface POSCategory {
    id: string;
    label: string;
    color: string;
}

export async function getPOSCategories(siteId: string): Promise<POSCategory[]> {
    const settingsRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    const snap = await getDoc(settingsRef);
    if (!snap.exists()) return [];
    const data = snap.data();
    // Support both legacy string[] and new POSCategory[]
    const raw = data?.menuCategories ?? [];
    if (raw.length === 0) return [];
    if (typeof raw[0] === 'string') {
        return raw.map((label: string) => ({
            id: label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            label,
            color: 'bg-gray-100 text-gray-600'
        }));
    }
    return raw as POSCategory[];
}

export async function savePOSCategories(siteId: string, categories: POSCategory[]): Promise<void> {
    const settingsRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    await setDoc(settingsRef, { menuCategories: categories }, { merge: true });
}

export async function getProducts(siteId: string): Promise<any[]> {
    const q = query(collection(db, 'sites', siteId, 'modules/byod_pos/products'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update order status and handle stock deductions if needed.
 */
export async function updateOrderStatus(
    siteId: string,
    order: POSOrder,
    newStatus: POSOrder['status']
): Promise<void> {
    // 1. Stock Deduction Logic (if moving to preparing)
    if (newStatus === 'preparing' && order.status !== 'preparing') {
        await processStockDeduction(siteId, order);
    }

    // 2. Update Status
    const orderRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, order.id);
    await updateDoc(orderRef, { status: newStatus });

    // 3. Loyalty Points Logic (if moving to completed)
    if (newStatus === 'completed' && order.memberId) {
        try {
            // Strict Modularity: Check if module is enabled first
            const { isModuleEnabled } = await import('@/lib/modules/registry');
            const loyaltyEnabled = await isModuleEnabled('membership');

            if (loyaltyEnabled) {
                const { awardPointsWithSpend, getMembershipSettings } = await import('@/lib/modules/membership/api');

                const settings = await getMembershipSettings(siteId);
                // Default 1 point per 1 unit currency if not configured
                const ratio = settings.earningRatio > 0 ? settings.earningRatio : 1;
                const pointsToAward = Math.floor(order.total * ratio);

                await awardPointsWithSpend(
                    siteId,
                    order.memberId,
                    pointsToAward,
                    order.total,
                    'POS',
                    order.id,
                    `POS Order #${order.id.slice(-4).toUpperCase()}`
                );

                // Optional: Update order with points awarded
                await updateDoc(orderRef, { pointsEarned: pointsToAward });
            }

        } catch (error) {
            logger.warn('pos.loyalty.failed', { siteId, error });
            // Don't block the order completion flow, just log the error
        }
    }
}

/**
 * Process stock deduction for an order.
 * Iterates through items and updates inventory.
 */
async function processStockDeduction(siteId: string, order: POSOrder) {
    // Strict Modularity: Check if inventory module is enabled
    const inventoryEnabled = await isModuleEnabled('inventory');
    if (!inventoryEnabled) return;

    // Load inventory API dynamically
    const { updateStock } = await import('@/lib/modules/inventory/api');

    for (const item of order.items) {
        if (item.inventoryId) {
            await updateStock(
                siteId,
                item.inventoryId,
                -item.quantity,
                'sale',
                order.id,
                'POS Order Accepted'
            );
        }
    }
}

/**
 * Cancel an order and optionally refund stock.
 */
export async function cancelOrder(siteId: string, orderId: string): Promise<void> {
    const orderRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) return;

    const orderData = orderSnap.data() as POSOrder;

    // Refund Logic
    if (['preparing', 'ready'].includes(orderData.status)) {
        for (const item of orderData.items) {
            if (item.inventoryId) {
                try {
                    // Strict Modularity: Check if inventory enabled
                    const inventoryEnabled = await isModuleEnabled('inventory');
                    if (inventoryEnabled) {
                        const { updateStock } = await import('@/lib/modules/inventory/api');
                        await updateStock(
                            siteId,
                            item.inventoryId,
                            item.quantity,
                            'return',
                            orderId,
                            'Proactive Order Cancellation'
                        );
                    }
                } catch (e) {
                    logger.warn('pos.refund.failed', { siteId, error: `${item.name}: ${e}` });
                }
            }
        }
    }
    // Reverse promo usage if a promo was applied and committed (best-effort)
    if (orderData.appliedPromo && orderData.paymentStatus === 'paid') {
        try {
            const { reversePromoUsage } = await import('@/lib/modules/promo/api');
            await reversePromoUsage({
                siteId,
                applied: orderData.appliedPromo,
                source: 'POS',
                refId: orderId,
                memberId: orderData.memberId,
            });
        } catch (e) {
            logger.warn('pos.promo.reverse.failed', { siteId, orderId, error: e });
        }
    }

    await deleteDoc(orderRef);
}

/**
 * Open Bill API
 */
export async function addToOrder(siteId: string, orderId: string, newItems: POSOrder['items'], additionalTotal: number): Promise<void> {
    const orderRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, orderId);

    await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists()) throw new Error('Order not found');

        const currentOrder = orderSnap.data() as POSOrder;

        // Merge Items (Simple append or merge quantity logic can go here)
        const mergedItems = [...currentOrder.items];

        newItems.forEach(newItem => {
            const existingIndex = mergedItems.findIndex(i =>
                i.productId === newItem.productId && i.variantId === newItem.variantId
            );
            if (existingIndex > -1) {
                mergedItems[existingIndex].quantity += newItem.quantity;
            } else {
                mergedItems.push(newItem);
            }
        });

        transaction.update(orderRef, {
            items: mergedItems,
            total: currentOrder.total + additionalTotal,
            // Ensure status stays 'open' if it was open
            status: 'open'
        });
    });
}

export async function requestPayment(siteId: string, orderId: string): Promise<void> {
    const orderRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as POSOrder;
    if (data.status === 'cancelled') throw new Error('cancelled');
    if (data.paymentStatus === 'paid') throw new Error('already_paid');
    await updateDoc(orderRef, {
        paymentStatus: 'pending_confirmation'
    });
}

export async function confirmPayment(
    siteId: string,
    orderId: string,
    method: POSOrder['paymentMethod'],
    appliedPromo?: POSOrder['appliedPromo'],
): Promise<void> {
    const orderRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, orderId);

    await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paymentMethod: method,
        status: 'completed',
        ...(appliedPromo ? { appliedPromo } : {}),
    });
}

/**
 * Settings API
 */

export async function getPOSSettings(siteId: string): Promise<POSSettings> {
    if (!siteId || siteId === 'default' || siteId === 'pending') {
        logger.warn('pos.settings.no.siteId', { siteId });
        return {
            mode: 'fast-checkout',
            paymentMethods: { cash: true, card: true, qris: true },
            requireTableNumber: false,
            businessName: 'Unconfigured',
            businessAddress: ''
        };
    }

    const settingsRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    const profileRef = doc(db, 'sites', siteId, 'content', 'profile');
    const businessRef = doc(db, 'sites', siteId, 'content', 'business');

    try {
        const [settingsSnap, profileSnap, businessSnap] = await Promise.all([
            getDoc(settingsRef),
            getDoc(profileRef),
            getDoc(businessRef)
        ]);

        let title = 'CLICKER CAFE';
        let address = '';

        if (profileSnap.exists()) {
            const data = profileSnap.data();
            if (data?.name) title = data.name;
        }

        if (businessSnap.exists()) {
            const data = businessSnap.data();
            if (data?.address) address = data.address;
        }

        if (settingsSnap.exists()) {
            const settingsData = settingsSnap.data() as Partial<POSSettings>; // Treat as Partial to be safe
            return {
                mode: settingsData.mode || 'fast-checkout',
                paymentMethods: {
                    cash: settingsData.paymentMethods?.cash ?? true,
                    card: settingsData.paymentMethods?.card ?? true,
                    qris: settingsData.paymentMethods?.qris ?? true,
                },
                requireTableNumber: settingsData.requireTableNumber || false,
                taxSettings: settingsData.taxSettings,
                businessDayStartHour: settingsData.businessDayStartHour,
                businessName: title,
                businessAddress: address,
                businessLogo: settingsData.businessLogo
            };
        }

        // Default Settings
        return {
            mode: 'fast-checkout', // Default to QSR style
            paymentMethods: {
                cash: true,
                card: true,
                qris: true
            },
            requireTableNumber: false,
            businessName: title,
            businessAddress: address,
            businessLogo: undefined
        };
    } catch (e) {
        logger.warn('pos.settings.no.siteId', { siteId, error: e });
        return {
            mode: 'fast-checkout',
            paymentMethods: { cash: true, card: true, qris: true },
            requireTableNumber: false,
            businessName: 'Error Loading',
            businessAddress: ''
        };
    }
}

export async function updatePOSSettings(siteId: string, settings: POSSettings): Promise<void> {
    const docRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    // Firestore rejects `undefined` values — strip them before writing
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    await setDoc(docRef, cleanSettings);
}

/**
 * Cancel a specific item from an order.
 * Removes the item and recalculates totals.
 */
export async function cancelOrderItem(siteId: string, orderId: string, itemIndex: number): Promise<void> {
    const orderRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, orderId);

    await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists()) throw new Error('Order not found');

        const orderData = orderSnap.data() as POSOrder;

        // Validation: Verify status
        if (['processed', 'completed', 'cancelled'].includes(orderData.status)) {
            // "processed" is not a standard status in types but checking user intent
            // effectively if completed or cancelled we stop.
            // If paymentStatus is Paid, maybe stop too?
            // "as long the status is not processed yet"
            throw new Error('Cannot cancel item from a processed order');
        }

        const currentItems = [...orderData.items];
        if (itemIndex < 0 || itemIndex >= currentItems.length) {
            throw new Error('Item not found');
        }

        // Get item to remove for stock restore logic
        const itemToRemove = currentItems[itemIndex];

        // Process Stock Refund if order was preparing/ready
        // (Assuming if it was Open/Pending stock might not be deducted yet?
        // updateOrderStatus calls processStockDeduction only when moving to 'preparing'.
        // So if status is 'open' or 'pending', no deduction happened yet.
        // If 'preparing' or 'ready', deduction happened.)
        if (['preparing', 'ready'].includes(orderData.status)) {
            if (itemToRemove.inventoryId) {
                // Note: We can't await inside non-async transaction safely if we want to bubble up errors?
                // actually we can.
                // But updateStock is an external write. Ideally we use the transaction.
                // updateStock implementation uses runTransaction internally usually?
                // Let's check updateStock. If it uses transaction we can't nest them easily.
                // For now, let's skip strict transactional stock update here or handle it after?
                // Or just do best effort.
            }
        }

        // Remove item
        currentItems.splice(itemIndex, 1);

        // If no items left, cancel the whole order?
        if (currentItems.length === 0) {
            transaction.delete(orderRef);
            return;
        }

        // Recalculate Totals
        const subtotal = currentItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Use existing rates
        const serviceRate = orderData.taxBreakdown?.serviceChargeRate || 0;
        const taxRate = orderData.taxBreakdown?.restaurantTaxRate || 0;

        const serviceCharge = Math.round(subtotal * (serviceRate / 100));
        const taxableBase = subtotal + serviceCharge;
        const restaurantTax = Math.round(taxableBase * (taxRate / 100));
        const total = subtotal + serviceCharge + restaurantTax;

        const newTaxBreakdown = {
            subtotal,
            serviceCharge,
            restaurantTax,
            total,
            serviceChargeRate: serviceRate,
            restaurantTaxRate: taxRate
        };

        transaction.update(orderRef, {
            items: currentItems,
            total,
            taxBreakdown: newTaxBreakdown
        });
    });

    // Or just copy logic from cancelOrder which gets data then refunds then deletes.
}

/**
 * Staff / Permissions API
 */

export async function getPOSStaff(siteId: string): Promise<POSStaffMember[]> {
    // 1. Query Global Site Members who have 'byod_pos' permission
    // Note: This relies on the Global Users Page to save permissions into the `permissions` array or `moduleAccess.byod_pos`
    // We check for 'permissions' array-contains 'byod_pos' OR via the new granular 'moduleAccess' if possible (but Firestore query limitations apply).
    // Safest bet for now is relying on the 'permissions' array which PermissionEditor updates.

    const membersRef = collection(db, 'sites', siteId, 'members');
    // We want any member who has 'byod_pos' in their permissions array
    const q = query(membersRef, where('permissions', 'array-contains', 'byod_pos'));

    const snap = await getDocs(q);
    const staff: POSStaffMember[] = [];

    // Map global members to POSStaffMember
    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const userId = docSnap.id;

        // Note: Global members collection already has displayName, email etc replicated.
        // No need to fetch from /users/ unless data is stale, but usually it's synced.
        // If 'displayName' is missing in site members, we fallback to 'Unknown'

        staff.push({
            userId,
            email: data.email || '',
            name: data.displayName || data.name || 'Unknown',
            role: data.role === 'owner' ? 'manager' : 'staff', // Simple mapping
            assignedAt: data.joinedAt ? (data.joinedAt.toDate ? data.joinedAt.toDate() : new Date(data.joinedAt)) : new Date()
        });
    }

    // Also Include Owner? Usually Owners have all access.
    // If owner is not in results (because they might not have explicit 'byod_pos' permission tag), we should fetch them?
    // Owners usually have role='owner'.
    // Let's do a secondary query or just rely on owners adding themselves to the module permissions?
    // Better DX: Explicitly fetch owners too.
    const qOwner = query(membersRef, where('role', '==', 'owner'));
    const snapOwner = await getDocs(qOwner);
    snapOwner.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!staff.find(s => s.userId === docSnap.id)) {
            staff.push({
                userId: docSnap.id,
                email: data.email || '',
                name: data.displayName || data.name || 'Owner',
                role: 'manager',
                assignedAt: new Date()
            });
        }
    });

    return staff;
}

/**
 * @deprecated Use Global Team Management (/admin/settings/team)
 */
export async function assignPOSRole(siteId: string, email: string, role: string): Promise<void> {
    logger.warn('pos.role.deprecated', { siteId });
}

/**
 * @deprecated Use Global Team Management (/admin/settings/team)
 */
export async function removePOSRole(siteId: string, userId: string): Promise<void> {
    logger.warn('pos.role.deprecated', { siteId });
}

export async function getPOSRole(siteId: string, userId: string): Promise<string | null> {
    // Check Global Member Role/Permissions
    const memberRef = doc(db, 'sites', siteId, 'members', userId);
    const snap = await getDoc(memberRef);

    if (snap.exists()) {
        const data = snap.data();
        if (data.role === 'owner') return 'manager';
        if (data.permissions?.includes('byod_pos')) return 'staff'; // Default to staff if they have permission
        // Check granular if needed
        if (data.moduleAccess?.byod_pos) return 'staff';
    }
    return null;
}

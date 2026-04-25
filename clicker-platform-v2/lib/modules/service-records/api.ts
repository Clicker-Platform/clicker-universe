import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    writeBatch,
    serverTimestamp,
    Timestamp,
    onSnapshot,
    QueryDocumentSnapshot,
    Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    SR_RECORDS,
    SR_VEHICLES,
    SR_WARRANTY_CARDS,
    SR_REMINDER_QUEUE,
    SR_CONFIG,
    SR_CAR_CATALOG,
    OUTLET_ID_V1,
    WARRANTY_CHARSET,
    WARRANTY_SUFFIX_LEN,
    WARRANTY_MAX_RETRIES,

} from './constants';
import {
    getServiceCatalog,
    createServiceCatalogItem,
    updateServiceCatalogItem,
} from '@/lib/core/serviceCatalog/api';
import type {
    ServiceRecord,
    Vehicle,
    ServiceType,
    WarrantyCard,
    ReminderQueueEntry,
    ServiceConfig,
    ServiceRecordFilters,
} from './types';
import { logger } from '@/lib/logger';

// ─── Utility ──────────────────────────────────────────────────────────────────

function normalizePlate(plate: string): string {
    return plate.toUpperCase().replace(/\s/g, '');
}

function generateWarrantySuffix(): string {
    let result = '';
    for (let i = 0; i < WARRANTY_SUFFIX_LEN; i++) {
        result += WARRANTY_CHARSET[Math.floor(Math.random() * WARRANTY_CHARSET.length)];
    }
    return result;
}

function generateWarrantyCode(prefix: string): string {
    const year = new Date().getFullYear();
    const suffix = generateWarrantySuffix();
    return `${prefix.toUpperCase()}-${year}-${suffix}`;
}

const DEFAULT_SERVICE_CONFIG: Omit<ServiceConfig, 'outletId'> = {
    warrantyPrefix: 'SVC',
    featuresEnabled: {
        warrantyCards: true,
        reminderEngine: false,
    },
    reminders: {
        r0Enabled: true,
        r1Enabled: true,
        r1DaysAfter: 10,
        r2Enabled: false,
        r2MonthsAfter: 6,
        r3Enabled: false,
        r3DaysBeforeExpiry: 30,
    },
    reminderTemplates: {
        r0: {
            subject: 'Your Warranty Card is Ready — {{serviceTypeName}}',
            body: 'Dear {{ownerName}},\n\nYour warranty card for {{serviceTypeName}} on {{vehiclePlate}} is ready.\n\nWarranty Code: {{warrantyCode}}\nValid until: {{warrantyExpiry}}\n\nView your warranty card: {{warrantyUrl}}\n\nThank you,\n{{businessName}}',
        },
        r1: {
            subject: 'How was your experience? — {{businessName}}',
            body: 'Dear {{ownerName}},\n\nWe hope your {{serviceTypeName}} experience on {{vehiclePlate}} was excellent!\n\nWe\'d love to hear your feedback.\n\nThank you,\n{{businessName}}',
        },
        r2: {
            subject: 'Time for your next service — {{vehiclePlate}}',
            body: 'Dear {{ownerName}},\n\nIt\'s been a while since your last service on {{vehiclePlate}}. Time to schedule your next maintenance!\n\nContact us to book an appointment.\n\nThank you,\n{{businessName}}',
        },
        r3: {
            subject: 'Your warranty expires soon — {{warrantyCode}}',
            body: 'Dear {{ownerName}},\n\nYour warranty for {{serviceTypeName}} on {{vehiclePlate}} ({{warrantyCode}}) will expire on {{warrantyExpiry}}.\n\nConsider renewing your protection.\n\nThank you,\n{{businessName}}',
        },
    },
};

// ─── Service Records ──────────────────────────────────────────────────────────

export async function getServiceRecordsByVehiclePlate(
    siteId: string,
    plate: string
): Promise<ServiceRecord[]> {
    const normalized = normalizePlate(plate);
    const q = query(
        collection(db, 'sites', siteId, SR_RECORDS),
        where('vehiclePlate', '==', normalized),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRecord));
}

export async function getServiceRecords(
    siteId: string,
    filters?: ServiceRecordFilters,
    lastDoc?: QueryDocumentSnapshot | null
): Promise<{ records: ServiceRecord[]; lastDoc: QueryDocumentSnapshot | null }> {
    const outletId = OUTLET_ID_V1(siteId);
    const pageLimit = filters?.limit || 50;

    let q = query(
        collection(db, 'sites', siteId, SR_RECORDS),
        where('outletId', '==', outletId),
        orderBy('updatedAt', 'desc'),
        limit(pageLimit)
    );

    if (filters?.status && filters.status !== 'ALL') {
        q = query(
            collection(db, 'sites', siteId, SR_RECORDS),
            where('outletId', '==', outletId),
            where('status', '==', filters.status),
            orderBy('updatedAt', 'desc'),
            limit(pageLimit)
        );
    }

    if (lastDoc) {
        q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRecord));
    const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    return { records, lastDoc: newLastDoc };
}

export async function getServiceRecord(siteId: string, id: string): Promise<ServiceRecord | null> {
    const snap = await getDoc(doc(db, 'sites', siteId, SR_RECORDS, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ServiceRecord;
}

export function subscribeToServiceRecord(
    siteId: string,
    id: string,
    callback: (record: ServiceRecord | null) => void
): Unsubscribe {
    return onSnapshot(doc(db, 'sites', siteId, SR_RECORDS, id), (snap) => {
        if (!snap.exists()) {
            callback(null);
            return;
        }
        callback({ id: snap.id, ...snap.data() } as ServiceRecord);
    });
}

export async function createServiceRecord(
    siteId: string,
    data: Omit<ServiceRecord, 'id' | 'outletId' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    const outletId = OUTLET_ID_V1(siteId);
    const ref = await addDoc(collection(db, 'sites', siteId, SR_RECORDS), {
        ...data,
        outletId,
        status: 'ACTIVE',
        paymentStatus: data.paymentStatus || 'UNPAID',
        amountPaid: data.amountPaid || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateServiceRecord(
    siteId: string,
    id: string,
    updates: Partial<Omit<ServiceRecord, 'id' | 'outletId' | 'createdAt' | 'createdBy'>>
): Promise<void> {
    const existing = await getServiceRecord(siteId, id);
    if (!existing) throw new Error('Service record not found');
    if (existing.status === 'COMPLETED') {
        throw new Error('COMPLETED records are immutable. Use amendment notes for corrections.');
    }
    await updateDoc(doc(db, 'sites', siteId, SR_RECORDS, id), {
        ...updates,
        updatedAt: serverTimestamp(),
    });

    // Award loyalty points when payment transitions to PAID for the first time
    const becomingPaid = updates.paymentStatus === 'PAID' && existing.paymentStatus !== 'PAID';
    if (becomingPaid && existing.memberId && !existing.loyaltyPointsAwarded) {
        const amountPaid = updates.amountPaid ?? existing.amountPaid ?? 0;
        try {
            const { isModuleEnabled } = await import('@/lib/modules/registry');
            if (await isModuleEnabled('membership')) {
                const { awardPointsWithSpend, getMembershipSettings } = await import('@/lib/modules/membership/api');
                const settings = await getMembershipSettings(siteId);
                if (settings.enableLoyalty && settings.earningRatio > 0) {
                    const points = Math.floor(amountPaid * settings.earningRatio);
                    if (points > 0) {
                        await awardPointsWithSpend(siteId, existing.memberId, points, amountPaid, 'SERVICE_RECORDS', id, existing.serviceTypeName);
                        await updateDoc(doc(db, 'sites', siteId, SR_RECORDS, id), { loyaltyPointsAwarded: points });
                    }
                }
            }
        } catch (err) {
            logger.error('service.loyalty.award.failed', { siteId, error: err });
        }
    }
}


export async function cancelRecord(siteId: string, id: string, cancelReason: string): Promise<void> {
    if (!cancelReason?.trim()) throw new Error('Cancel reason is required');
    const record = await getServiceRecord(siteId, id);
    if (!record) throw new Error('Service record not found');
    if (record.status === 'COMPLETED') {
        throw new Error('COMPLETED records cannot be cancelled');
    }
    await updateDoc(doc(db, 'sites', siteId, SR_RECORDS, id), {
        status: 'CANCELLED',
        cancelReason: cancelReason.trim(),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Completes an ACTIVE record atomically via the Bill & Approve flow:
 * 1. Updates record to COMPLETED with final payment details
 * 2. Creates warrantyCard (if hasWarranty = true)
 * 3. Updates record with warrantyCardId
 * 4. Writes reminder queue entries (R0–R3) based on serviceConfig
 * 5. After batch: deducts inventory, completes booking, awards membership points
 *
 * NOTE: In production, this is handled by the onServiceRecordCompleted Cloud Function.
 * This client-side implementation is the v1.0 fallback until Cloud Functions are deployed.
 */
export async function approveRecord(
    siteId: string,
    recordId: string,
    approvedByEmail: string,
    businessName?: string,
    businessLogo?: string
): Promise<void> {
    const record2 = await getServiceRecord(siteId, recordId);
    if (!record2) throw new Error('Service record not found');
    if (record2.status !== 'ACTIVE') {
        throw new Error('Only ACTIVE records can be completed');
    }
    if (record2.paymentStatus !== 'PAID') {
        throw new Error('Payment must be PAID before completing the record');
    }

    const config = await getServiceConfig(siteId);
    const approvedAt = Timestamp.now();
    const batch = writeBatch(db);
    const recordRef = doc(db, 'sites', siteId, SR_RECORDS, recordId);

    // Step 1 — Update record to COMPLETED
    batch.update(recordRef, {
        status: 'COMPLETED',
        approvedBy: approvedByEmail,
        approvedAt,
        updatedAt: serverTimestamp(),
    });

    let warrantyCardId: string | undefined;

    // Step 2 — Create warranty card (if applicable)
    if (record2.hasWarranty && config.featuresEnabled.warrantyCards) {
        // Generate unique warranty code (retry up to WARRANTY_MAX_RETRIES times)
        let warrantyCode: string | null = null;
        for (let attempt = 0; attempt < WARRANTY_MAX_RETRIES; attempt++) {
            const candidate = generateWarrantyCode(config.warrantyPrefix);
            // Check uniqueness within this tenant's warrantyCards collection
            const existing = await getDocs(
                query(collection(db, 'sites', siteId, SR_WARRANTY_CARDS), where('warrantyCode', '==', candidate), limit(1))
            );
            if (existing.empty) {
                warrantyCode = candidate;
                break;
            }
        }
        if (!warrantyCode) throw new Error('Could not generate unique warranty code after retries');

        const warrantyMonths = record2.warrantyMonths || 12;
        const serviceDateMs = approvedAt.toMillis();
        const expiryDate = new Timestamp(
            Math.floor(serviceDateMs / 1000) + warrantyMonths * 30 * 24 * 60 * 60,
            0
        );

        const warrantyRef = doc(collection(db, 'sites', siteId, SR_WARRANTY_CARDS));
        warrantyCardId = warrantyRef.id;

        const cardData: Record<string, unknown> = {
            warrantyCode,
            serviceRecordId: recordId,
            outletId: OUTLET_ID_V1(siteId),
            vehiclePlate: record2.vehiclePlate,
            serviceTypeName: record2.serviceTypeName,
            serviceDate: approvedAt,
            warrantyMonths,
            expiryDate,
            status: 'ACTIVE',
            businessName: businessName || siteId,
            createdAt: approvedAt,
        };
        // Only include optional fields if defined — Firestore rejects undefined values
        if (record2.memberName) cardData.ownerName = record2.memberName;
        if (record2.memberPhone) cardData.ownerPhone = record2.memberPhone;
        if (record2.productUsed) cardData.productUsed = record2.productUsed;
        if (businessLogo) cardData.businessLogo = businessLogo;
        batch.set(warrantyRef, cardData);

        // Step 3 — Update record with warrantyCardId
        batch.update(recordRef, { warrantyCardId });
    }

    // Step 4 — Write reminder queue entries
    if (config.featuresEnabled.reminderEngine) {
        const hasContact = !!(record2.memberEmail || record2.memberPhone);
        const outletId = OUTLET_ID_V1(siteId);

        const writeReminder = (
            type: ReminderQueueEntry['type'],
            scheduledAt: Timestamp
        ) => {
            const remRef = doc(collection(db, 'sites', siteId, SR_REMINDER_QUEUE));
            const entry: Omit<ReminderQueueEntry, 'id'> = {
                type,
                serviceRecordId: recordId,
                warrantyCardId,
                outletId,
                recipientName: record2.memberName,
                recipientEmail: record2.memberEmail,
                recipientPhone: record2.memberPhone,
                channel: 'EMAIL',
                scheduledAt,
                status: hasContact ? 'PENDING' : 'SKIPPED',
            };
            batch.set(remRef, entry);
        };

        const now = approvedAt.toMillis();
        const DAY_MS = 86_400_000;

        if (config.reminders.r0Enabled && record2.hasWarranty && config.featuresEnabled.warrantyCards) {
            writeReminder('WARRANTY_DELIVERY', approvedAt);
        }
        if (config.reminders.r1Enabled) {
            writeReminder('FEEDBACK_SURVEY', new Timestamp(
                Math.floor((now + config.reminders.r1DaysAfter * DAY_MS) / 1000), 0
            ));
        }
        if (config.reminders.r2Enabled) {
            writeReminder('MAINTENANCE', new Timestamp(
                Math.floor((now + config.reminders.r2MonthsAfter * 30 * DAY_MS) / 1000), 0
            ));
        }
        if (config.reminders.r3Enabled && record2.hasWarranty && config.featuresEnabled.warrantyCards && warrantyCardId) {
            const expiryMs = record2.warrantyMonths
                ? now + record2.warrantyMonths * 30 * DAY_MS
                : now;
            writeReminder('WARRANTY_EXPIRY', new Timestamp(
                Math.floor((expiryMs - config.reminders.r3DaysBeforeExpiry * DAY_MS) / 1000), 0
            ));
        }
    }

    await batch.commit();


    // Step 6 — Deduct inventory stock (non-blocking)
    try {
        const { isModuleEnabled } = await import('@/lib/modules/registry');
        const inventoryOn = await isModuleEnabled('inventory');

        if (inventoryOn) {
            const { updateStock } = await import('@/lib/modules/inventory/api');

            // Path A: new multi-item consumedItems array
            if (record2.consumedItems && record2.consumedItems.length > 0 && !record2.inventoryDeducted) {
                for (const item of record2.consumedItems) {
                    await updateStock(
                        siteId,
                        item.inventoryItemId,
                        -Math.abs(item.quantity),
                        'sale',
                        recordId,
                        `Consumed for ${record2.serviceTypeName}`
                    );
                }
                await updateDoc(recordRef, { inventoryDeducted: true });

            // Path B: legacy single inventoryItemId (deprecated — kept for old records)
            } else if (record2.inventoryItemId && !record2.inventoryDeducted) {
                await updateStock(siteId, record2.inventoryItemId, -1, 'sale', recordId, record2.serviceTypeName);
                await updateDoc(recordRef, { inventoryDeducted: true });
            }
        }
    } catch (err) {
        logger.error('service.inventory.deduct.failed', { siteId, error: err });
    }

    // Step 7 — Auto-complete linked reservation booking (non-blocking)
    if (record2.bookingId && record2.bookingSource === 'reservation') {
        try {
            const { updateBookingStatus, updateBookingDetails } = await import('@/lib/modules/reservation/api');
            await updateBookingDetails(siteId, record2.bookingId, { serviceRecordId: recordId });
            await updateBookingStatus(siteId, record2.bookingId, 'completed');
        } catch (err) {
            logger.error('service.booking.complete.failed', { siteId, error: err });
        }
    }

    // Step 8 — Award loyalty points (non-blocking — failure must NOT roll back COMPLETED)
    if (record2.memberId && !record2.loyaltyPointsAwarded) {
        try {
            const { isModuleEnabled } = await import('@/lib/modules/registry');
            if (await isModuleEnabled('membership')) {
                const { awardPointsWithSpend, getMembershipSettings } = await import('@/lib/modules/membership/api');
                const settings = await getMembershipSettings(siteId);
                if (settings.enableLoyalty && settings.earningRatio > 0) {
                    const amountPaid = record2.amountPaid ?? record2.totalAmount ?? 0;
                    const points = Math.floor(amountPaid * settings.earningRatio);
                    if (points > 0) {
                        await awardPointsWithSpend(siteId, record2.memberId, points, amountPaid, 'SERVICE_RECORDS', recordId, record2.serviceTypeName);
                        await updateDoc(doc(db, 'sites', siteId, SR_RECORDS, recordId), { loyaltyPointsAwarded: points });
                    }
                }
            }
        } catch (err) {
            logger.error('service.loyalty.award.failed', { siteId, error: err });
        }
    }
}

// ─── Manual Warranty Card Generation ──────────────────────────────────────────
// Used when a COMPLETED record has hasWarranty=true but no warrantyCardId,
// e.g. when the feature was toggled off at approval time.

export async function generateWarrantyCardForRecord(
    siteId: string,
    recordId: string,
    businessName?: string,
    businessLogo?: string,
): Promise<string> {
    const record2 = await getServiceRecord(siteId, recordId);
    if (!record2) throw new Error('Service record not found');
    if (record2.status !== 'COMPLETED') throw new Error('Only COMPLETED records can have a warranty card generated');
    if (!record2.hasWarranty) throw new Error('This record does not have warranty enabled');
    if (record2.warrantyCardId) throw new Error('A warranty card already exists for this record');

    const config = await getServiceConfig(siteId);

    // Generate unique warranty code
    let warrantyCode: string | null = null;
    for (let attempt = 0; attempt < WARRANTY_MAX_RETRIES; attempt++) {
        const candidate = generateWarrantyCode(config.warrantyPrefix);
        const existing = await getDocs(
            query(collection(db, 'sites', siteId, SR_WARRANTY_CARDS), where('warrantyCode', '==', candidate), limit(1))
        );
        if (existing.empty) {
            warrantyCode = candidate;
            break;
        }
    }
    if (!warrantyCode) throw new Error('Could not generate unique warranty code after retries');

    const now = Timestamp.now();
    const warrantyMonths = record2.warrantyMonths || 12;
    const expiryDate = new Timestamp(
        Math.floor(now.toMillis() / 1000) + warrantyMonths * 30 * 24 * 60 * 60,
        0
    );

    const warrantyRef = doc(collection(db, 'sites', siteId, SR_WARRANTY_CARDS));
    const warrantyCardId = warrantyRef.id;

    const cardData: Record<string, unknown> = {
        warrantyCode,
        serviceRecordId: recordId,
        outletId: OUTLET_ID_V1(siteId),
        vehiclePlate: record2.vehiclePlate,
        serviceTypeName: record2.serviceTypeName,
        serviceDate: record2.approvedAt || now,
        warrantyMonths,
        expiryDate,
        status: 'ACTIVE',
        businessName: businessName || siteId,
        createdAt: now,
    };
    if (record2.memberName) cardData.ownerName = record2.memberName;
    if (record2.memberPhone) cardData.ownerPhone = record2.memberPhone;
    if (record2.productUsed) cardData.productUsed = record2.productUsed;
    if (businessLogo) cardData.businessLogo = businessLogo;

    const batch = writeBatch(db);
    batch.set(warrantyRef, cardData);
    batch.update(doc(db, 'sites', siteId, SR_RECORDS, recordId), { warrantyCardId });
    await batch.commit();

    return warrantyCardId;
}



export async function getVehicles(siteId: string): Promise<Vehicle[]> {
    const outletId = OUTLET_ID_V1(siteId);
    const q = query(
        collection(db, 'sites', siteId, SR_VEHICLES),
        where('outletId', '==', outletId),
        orderBy('plateNumber')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
}

export async function getVehicle(siteId: string, id: string): Promise<Vehicle | null> {
    const snap = await getDoc(doc(db, 'sites', siteId, SR_VEHICLES, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Vehicle;
}

export async function findVehicleByPlate(siteId: string, plate: string): Promise<Vehicle | null> {
    const normalized = normalizePlate(plate);
    const q = query(
        collection(db, 'sites', siteId, SR_VEHICLES),
        where('plateNumber', '==', normalized),
        limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Vehicle;
}

export async function createVehicle(
    siteId: string,
    data: Omit<Vehicle, 'id' | 'outletId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    const outletId = OUTLET_ID_V1(siteId);
    const payload: Record<string, unknown> = {
        plateNumber: normalizePlate(data.plateNumber),
        outletId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    // Only include optional fields if they are defined — Firestore rejects undefined values
    if (data.carCatalogId !== undefined) payload.carCatalogId = data.carCatalogId;
    if (data.color !== undefined) payload.color = data.color;
    if (data.memberId !== undefined) payload.memberId = data.memberId;
    if (data.memberName !== undefined) payload.memberName = data.memberName;
    const ref = await addDoc(collection(db, 'sites', siteId, SR_VEHICLES), payload);
    return ref.id;
}

export async function updateVehicle(
    siteId: string,
    id: string,
    data: Partial<Omit<Vehicle, 'id' | 'outletId' | 'createdAt'>>
): Promise<void> {
    const updates: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
    if (data.plateNumber) {
        updates.plateNumber = normalizePlate(data.plateNumber);
    }
    await updateDoc(doc(db, 'sites', siteId, SR_VEHICLES, id), updates);
}

// ─── Service Types (reads from shared serviceCatalog) ─────────────────────────

function catalogToServiceType(item: any): ServiceType {
    const src = item.serviceRecordsConfig;
    return {
        id: item.id,
        name: item.name,
        category: item.category,
        hasWarranty: src?.hasWarranty ?? false,
        defaultWarrantyMonths: src?.defaultWarrantyMonths,
        defaultPrice: src?.defaultPrice,
        isActive: item.isActive,
        outletId: item.outletId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    };
}

export async function getServiceTypes(siteId: string, activeOnly = false): Promise<ServiceType[]> {
    const items = await getServiceCatalog(siteId, { activeOnly });
    return items
        .filter((i) => i.serviceRecordsConfig !== undefined && i.serviceRecordsConfig !== null)
        .map(catalogToServiceType);
}

export async function createServiceType(
    siteId: string,
    data: Omit<ServiceType, 'id' | 'outletId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    return createServiceCatalogItem(siteId, {
        name: data.name,
        category: data.category,
        price: data.defaultPrice ?? 0,
        durationMinutes: 60,
        isActive: data.isActive ?? true,
        serviceRecordsConfig: {
            hasWarranty: data.hasWarranty,
            defaultWarrantyMonths: data.defaultWarrantyMonths,
            defaultPrice: data.defaultPrice,
        },
    });
}

export async function updateServiceType(
    siteId: string,
    id: string,
    data: Partial<Omit<ServiceType, 'id' | 'outletId' | 'createdAt'>>
): Promise<void> {
    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.category !== undefined) patch.category = data.category;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.hasWarranty !== undefined || data.defaultWarrantyMonths !== undefined || data.defaultPrice !== undefined) {
        // Merge serviceRecordsConfig — fetch current item first
        const { getServiceCatalogItem } = await import('@/lib/core/serviceCatalog/api');
        const current = await getServiceCatalogItem(siteId, id);
        const existing = current?.serviceRecordsConfig ?? { hasWarranty: false };
        patch.serviceRecordsConfig = {
            ...existing,
            ...(data.hasWarranty !== undefined ? { hasWarranty: data.hasWarranty } : {}),
            ...(data.defaultWarrantyMonths !== undefined ? { defaultWarrantyMonths: data.defaultWarrantyMonths } : {}),
            ...(data.defaultPrice !== undefined ? { defaultPrice: data.defaultPrice } : {}),
        };
    }
    await updateServiceCatalogItem(siteId, id, patch);
}

export async function toggleServiceType(siteId: string, id: string, isActive: boolean): Promise<void> {
    await updateServiceCatalogItem(siteId, id, { isActive });
}

// ─── Service Config ───────────────────────────────────────────────────────────

export async function getServiceConfig(siteId: string): Promise<ServiceConfig> {
    const outletId = OUTLET_ID_V1(siteId);
    const ref = doc(db, 'sites', siteId, SR_CONFIG, outletId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
        return { outletId, ...snap.data() } as ServiceConfig;
    }
    // Doc doesn't exist yet — return defaults without writing (write requires owner role).
    // Owner can persist via Settings page; all reads fall back to these defaults.
    return { outletId, ...DEFAULT_SERVICE_CONFIG };
}

export async function updateServiceConfig(
    siteId: string,
    data: Partial<Omit<ServiceConfig, 'outletId'>>
): Promise<void> {
    const outletId = OUTLET_ID_V1(siteId);
    const ref = doc(db, 'sites', siteId, SR_CONFIG, outletId);
    await setDoc(ref, { ...data, outletId, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── Warranty Cards ───────────────────────────────────────────────────────────

export async function getWarrantyCard(siteId: string, id: string): Promise<WarrantyCard | null> {
    const snap = await getDoc(doc(db, 'sites', siteId, SR_WARRANTY_CARDS, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as WarrantyCard;
}

export async function voidWarrantyCard(siteId: string, id: string): Promise<void> {
    await updateDoc(doc(db, 'sites', siteId, SR_WARRANTY_CARDS, id), {
        status: 'VOIDED',
    });
}

// ─── Reminder Queue ───────────────────────────────────────────────────────────

export async function getReminderQueue(
    siteId: string,
    statusFilter?: ReminderQueueEntry['status']
): Promise<ReminderQueueEntry[]> {
    const outletId = OUTLET_ID_V1(siteId);
    let q = query(
        collection(db, 'sites', siteId, SR_REMINDER_QUEUE),
        where('outletId', '==', outletId),
        orderBy('scheduledAt', 'desc'),
        limit(50)
    );
    if (statusFilter) {
        q = query(
            collection(db, 'sites', siteId, SR_REMINDER_QUEUE),
            where('outletId', '==', outletId),
            where('status', '==', statusFilter),
            orderBy('scheduledAt', 'desc'),
            limit(50)
        );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ReminderQueueEntry));
}

// ─── Car Catalog ─────────────────────────────────────────────────────────────

import type { CarCatalogEntry, VehicleType } from './types';

export async function getCarCatalog(siteId: string): Promise<CarCatalogEntry[]> {
    const q = query(
        collection(db, 'sites', siteId, SR_CAR_CATALOG),
        orderBy('make', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CarCatalogEntry));
}

export async function addCarCatalogEntry(
    siteId: string,
    data: { make: string; model: string; type: VehicleType }
): Promise<string> {
    const ref = await addDoc(
        collection(db, 'sites', siteId, SR_CAR_CATALOG),
        { ...data, createdAt: serverTimestamp() }
    );
    return ref.id;
}

export async function updateCarCatalogEntry(
    siteId: string,
    id: string,
    data: { make: string; model: string; type: VehicleType }
): Promise<void> {
    await updateDoc(doc(db, 'sites', siteId, SR_CAR_CATALOG, id), { ...data });
}

/** Ensure a make/model/type combo exists in the catalog. Returns the entry id. */
export async function ensureCarCatalogEntry(
    siteId: string,
    data: { make: string; model: string; type: VehicleType }
): Promise<string> {
    const existing = await getCarCatalog(siteId);
    const match = existing.find(
        e => e.make.toLowerCase() === data.make.toLowerCase()
          && e.model.toLowerCase() === data.model.toLowerCase()
    );
    if (match) return match.id;
    return addCarCatalogEntry(siteId, data);
}

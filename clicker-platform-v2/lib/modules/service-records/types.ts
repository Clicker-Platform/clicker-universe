import { Timestamp } from 'firebase/firestore';

// ─── Consumed Item (multi-product deduction) ─────────────────────────────────

export interface ConsumedItem {
    inventoryItemId: string;
    name: string;       // denormalized for display — avoids extra reads
    quantity: number;   // units consumed
}

// ─── Service Record ───────────────────────────────────────────────────────────

export type RecordStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'QRIS';

export interface ServiceRecord {
    id: string;
    outletId: string;           // required, never null; v1.0 = siteId
    vehicleId: string;
    vehiclePlate: string;       // denormalized for display
    memberId?: string;          // null = walk-in
    memberName?: string;        // denormalized
    memberPhone?: string;       // denormalized; used for reminders
    memberEmail?: string;       // optional walk-in capture
    serviceTypeId: string;
    serviceTypeName: string;    // denormalized
    hasWarranty: boolean;       // snapshotted from serviceType at creation
    warrantyMonths: number;     // editable until COMPLETED
    productUsed?: string;       // e.g. "Ceramic Pro Gold 9H" — free-text escape hatch, DO NOT REMOVE
    status: RecordStatus;
    paymentStatus: PaymentStatus;
    paymentMethod?: PaymentMethod;
    totalAmount: number;
    amountPaid: number;
    notes?: string;
    cancelReason?: string;      // required when CANCELLED
    warrantyCardId?: string;    // set on COMPLETED (if hasWarranty)
    loyaltyPointsAwarded?: number; // set after addPoints() succeeds
    inventoryItemId?: string;   // @deprecated — superseded by consumedItems; kept for legacy reads
    consumedItems?: ConsumedItem[]; // array of products & quantities consumed in this service
    inventoryDeducted?: boolean;// set to true after successful stock deduction
    bookingId?: string;         // source reservation booking ID (if created from a booking)
    bookingSource?: 'reservation';
    approvedBy?: string;        // email of approver, set on COMPLETED
    approvedAt?: Timestamp;     // set on COMPLETED
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;          // user email or uid
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export type VehicleType = 'SEDAN' | 'SUV' | 'MPV' | 'HATCHBACK' | 'PICKUP' | 'MOTORCYCLE' | 'OTHER';

export interface CarCatalogEntry {
    id: string;
    make: string;               // e.g. "Toyota"
    model: string;              // e.g. "Fortuner"
    type: VehicleType;          // e.g. "SUV"
    createdAt: Timestamp;
}

export interface Vehicle {
    id: string;
    plateNumber: string;        // normalized: uppercase, no spaces — dedup key
    carCatalogId?: string;      // FK → CarCatalogEntry (optional for backward compat)
    color?: string;
    memberId?: string;          // linked member (optional)
    memberName?: string;        // denormalized
    outletId: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─── Service Type ─────────────────────────────────────────────────────────────

// ServiceCategory is owned by Core — re-exported here for backward compat
export type { ServiceCategory } from '@/lib/core/serviceCatalog/types';

// ServiceType is now a projection of ServiceCatalogItem from Core.
// All reads/writes go through lib/core/serviceCatalog/api.ts.
export interface ServiceType {
    id: string;
    name: string;
    category: import('@/lib/core/serviceCatalog/types').ServiceCategory;
    hasWarranty: boolean;
    defaultWarrantyMonths?: number;
    defaultPrice?: number;
    isActive: boolean;
    outletId: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─── Warranty Card ────────────────────────────────────────────────────────────

export type WarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'VOIDED';

export interface WarrantyCard {
    id: string;
    warrantyCode: string;       // globally unique, format: {PREFIX}-{YEAR}-{4-char}
    serviceRecordId: string;
    outletId: string;
    // All fields below are SNAPSHOTTED at card creation — never referenced live
    vehiclePlate: string;
    vehicleType?: string;
    vehicleMakeModel?: string;
    ownerName?: string;
    ownerPhone?: string;
    serviceTypeName: string;
    productUsed?: string;
    serviceDate: Timestamp;
    warrantyMonths: number;
    expiryDate: Timestamp;
    status: WarrantyStatus;
    businessName: string;
    businessLogo?: string;
    createdAt: Timestamp;
}

// Serialized form of WarrantyCard (Timestamps converted to ISO strings)
// Used when passing card data from Server Components to Client Components
export interface SerializedWarrantyCard extends Omit<WarrantyCard, 'serviceDate' | 'expiryDate' | 'createdAt'> {
    serviceDate: string;
    expiryDate: string;
    createdAt: string;
}

// ─── Reminder Queue ───────────────────────────────────────────────────────────

export type ReminderType = 'WARRANTY_DELIVERY' | 'FEEDBACK_SURVEY' | 'MAINTENANCE' | 'WARRANTY_EXPIRY';
export type ReminderChannel = 'EMAIL' | 'WHATSAPP'; // v1.0: EMAIL handler stub only
export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface ReminderQueueEntry {
    id: string;
    type: ReminderType;
    serviceRecordId: string;
    warrantyCardId?: string;
    outletId: string;
    recipientName?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    channel: ReminderChannel;
    scheduledAt: Timestamp;
    status: ReminderStatus;
    sentAt?: Timestamp;
    errorMessage?: string;
}

// ─── Service Config ───────────────────────────────────────────────────────────

export interface ReminderTemplate {
    subject: string;
    body: string; // Supports template variables: {{ownerName}}, {{vehiclePlate}}, etc.
}

export interface ServiceConfig {
    outletId: string;
    warrantyPrefix: string;     // e.g. 'MRB' — used in warranty code generation
    featuresEnabled: {
        warrantyCards: boolean; // false = suppress all warranty UI
        reminderEngine: boolean;// false = no reminder queue entries written
    };
    reminders: {
        r0Enabled: boolean;             // WARRANTY_DELIVERY — immediate on completion
        r1Enabled: boolean;             // FEEDBACK_SURVEY
        r1DaysAfter: number;            // days after completion (default: 10)
        r2Enabled: boolean;             // MAINTENANCE — repeating
        r2MonthsAfter: number;          // months after completion (default: 6)
        r3Enabled: boolean;             // WARRANTY_EXPIRY — hasWarranty only
        r3DaysBeforeExpiry: number;     // days before expiry (default: 30)
    };
    reminderTemplates: {
        r0: ReminderTemplate;
        r1: ReminderTemplate;
        r2: ReminderTemplate;
        r3: ReminderTemplate;
    };
    updatedAt?: Timestamp;
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

export interface ServiceRecordFilters {
    status?: RecordStatus | 'ALL';
    outletId?: string;
    limit?: number;
    lastDocId?: string;
}

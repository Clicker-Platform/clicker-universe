// Firestore subcollection paths (relative to sites/{siteId}/)
// Full Firestore path: sites/{siteId}/{CONSTANT}
export const SR_BASE           = 'modules/service_records';
export const SR_RECORDS        = `${SR_BASE}/serviceRecords`;
export const SR_VEHICLES       = `${SR_BASE}/vehicles`;
export const SR_SERVICE_TYPES  = `${SR_BASE}/serviceTypes`;
export const SR_WARRANTY_CARDS = `${SR_BASE}/warrantyCards`;
export const SR_REMINDER_QUEUE = `${SR_BASE}/reminderQueue`;
export const SR_CONFIG         = `${SR_BASE}/serviceConfig`;

// v1.0: outletId always equals siteId (single-outlet).
// When multi-outlet support is added, replace this with actual outlet resolution.
export const OUTLET_ID_V1 = (siteId: string): string => siteId;

// Warranty code generation
// Format: {PREFIX}-{YEAR}-{4-char alphanumeric}  e.g. MRB-2026-A4F9
// Excludes visually ambiguous chars: 0, O, 1, I
export const WARRANTY_CHARSET     = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const WARRANTY_SUFFIX_LEN  = 4;
export const WARRANTY_MAX_RETRIES = 3;

// Record status state machine
// DRAFT → IN_PROGRESS → PENDING_APPROVAL → COMPLETED (terminal, immutable)
// Any non-COMPLETED → CANCELLED (manager/owner only)
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
    DRAFT:              ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS:        ['PENDING_APPROVAL', 'CANCELLED'],
    PENDING_APPROVAL:   ['COMPLETED', 'IN_PROGRESS', 'CANCELLED'],
    COMPLETED:          [],
    CANCELLED:          [],
};

// Required Firestore composite indexes (document here for ops reference):
// 1. sites/{siteId}/modules/service_records/serviceRecords
//    - outletId (==) + status (==) + updatedAt (desc)
//    - outletId (==) + status (==) + createdAt (desc)
//    - outletId (==) + updatedAt (desc)   [for ALL tab]
// 2. sites/{siteId}/modules/service_records/vehicles
//    - outletId (==) + plateNumber (asc)
// 3. sites/{siteId}/modules/service_records/reminderQueue
//    - status (==) + scheduledAt (asc)   [for Cloud Function processing]
// 4. warrantyCards (collectionGroup index)
//    - warrantyCode (==)   [required for public warranty lookup]

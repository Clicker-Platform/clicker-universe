import { Timestamp } from 'firebase/firestore';

// Dynamic string — admins configure categories per outlet via settings/serviceCategories.
// The 5 legacy defaults (COATING, PPF, DETAILING, WASH, OTHER) are seeded automatically.
export type ServiceCategory = string;

// Per-outlet category configuration, stored in settings/serviceCategories
export interface ServiceCategoryConfig {
    id: string;         // slug key, e.g. "coating"
    label: string;      // display label, e.g. "COATING" or "Ceramic Coating"
    color: string;      // tailwind classes, e.g. "bg-blue-100 text-blue-700"
}

export const DEFAULT_SERVICE_CATEGORIES: ServiceCategoryConfig[] = [
    { id: 'coating',   label: 'COATING',   color: 'bg-blue-100 text-blue-700' },
    { id: 'ppf',       label: 'PPF',       color: 'bg-purple-100 text-purple-700' },
    { id: 'detailing', label: 'DETAILING', color: 'bg-amber-100 text-amber-700' },
    { id: 'wash',      label: 'WASH',      color: 'bg-cyan-100 text-cyan-700' },
    { id: 'other',     label: 'OTHER',     color: 'bg-gray-100 text-gray-600' },
];

export interface ServiceCatalogItem {
    id: string;
    name: string;
    description?: string;       // displayed in Reservation booking UI
    price: number;
    durationMinutes?: number;   // required only for time_slot bookings; undefined for request-type bookings
    category: ServiceCategory;  // free string; defaults to 'OTHER'
    isActive: boolean;
    outletId: string;           // v1.0: always equals siteId
    imageUrl?: string;          // optional, for future use
    createdAt: Timestamp;
    updatedAt: Timestamp;

    // Optional module-specific extensions.
    // Presence of reservationConfig = item appears in public booking form.
    // Presence of serviceRecordsConfig = item appears in SR service type selector.
    reservationConfig?: {
        bookingType: 'time_slot' | 'request';
        // durationMinutes is top-level (only used when bookingType === 'time_slot').
        maxPrice?: number;  // upper bound for 'range' pricing display; only used by reservation module
    };
    serviceRecordsConfig?: {
        hasWarranty: boolean;
        defaultWarrantyMonths?: number;
        defaultPrice?: number;  // optional walk-in price override
    };
}

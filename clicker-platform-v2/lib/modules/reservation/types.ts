import { Timestamp } from 'firebase/firestore';

// Service is now a projection of ServiceCatalogItem from Core.
// All reads/writes go through lib/core/serviceCatalog/api.ts.
export interface Service {
    id: string;
    name: string;
    description?: string;
    durationMinutes?: number;                   // undefined for request-type bookings
    bookingType?: 'time_slot' | 'request';      // promoted from reservationConfig; defaults to 'time_slot'
    price: number;
    maxPrice?: number;                          // upper bound for 'range' pricing display
    isActive: boolean;
    imageUrl?: string;
    category?: string;      // mapped from ServiceCatalogItem.category
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface Booking {
    id: string;
    serviceId: string;
    serviceName: string; // denormalized for easy display
    customerId: string; // or 'guest'
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    isRead?: boolean;
    startAt: Timestamp;
    endAt: Timestamp;
    staffId?: string;
    staffName?: string;
    notes?: string;
    totalPrice: number;
    preferredDate?: string;     // ISO date YYYY-MM-DD; set for request-type bookings by the customer
    createdAt: Timestamp;
    serviceRecordId?: string;   // linked Service Record (set when "Start Service Record" is clicked)
    bookingId?: string;
    cancellationReason?: string; // reason provided by admin when cancelling/rejecting
    assetId?: string;           // captures the customer-provided asset (e.g. license plate, room ID)
    assetModel?: string;        // captures the asset model or type (e.g. Toyota Fortuner)
}

export type PricingDisplay = 'fixed' | 'starting_from' | 'range' | 'hidden';

export interface ReservationSettings {
    allowStaffSelection: boolean;
    staffLabel?: string;        // label for staff/resource (default: 'Staff'; e.g. 'Technician', 'Therapist')
    pricingDisplay?: PricingDisplay; // how prices appear on the public booking form (default: 'fixed')
    membershipEnabled?: boolean; // derived from module registry, not stored
    bookingTitle?: string;      // custom heading for step 1 (default: 'Select Service'; e.g. 'Book a Service')
    formConfig?: {
        requireAsset: boolean;          // if true, show asset input on booking form (e.g. license plate)
        assetLabel: string;             // e.g. 'License Plate' or 'Room ID'
        assetPlaceholder: string;       // e.g. 'B 1234 CD'
        requireAssetModel: boolean;     // if true, show asset model input (e.g. car make/model)
        assetModelLabel: string;        // e.g. 'Vehicle Make & Model'
    };
}

export interface TimeSlot {
    id: string;
    dayOfWeek: number; // 0=Sunday, 1=Monday...
    startTime: string; // "09:00"
    endTime: string; // "17:00"
    isActive: boolean;
    maxConcurrent: number;
}

export interface Staff {
    id: string;
    name: string;
    label: string;
    isActive: boolean;
    createdAt?: Timestamp | number | null;
}

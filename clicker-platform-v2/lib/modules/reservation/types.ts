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
    cancellationReason?: string; // reason provided by admin when cancelling/rejecting
}

export type PricingDisplay = 'fixed' | 'starting_from' | 'range' | 'hidden';

export interface ReservationSettings {
    allowStaffSelection: boolean;
    staffLabel?: string;        // label for staff/resource (default: 'Staff'; e.g. 'Technician', 'Therapist')
    pricingDisplay?: PricingDisplay; // how prices appear on the public booking form (default: 'fixed')
    membershipEnabled?: boolean; // derived from module registry, not stored
    bookingTitle?: string;      // custom heading for step 1 (default: 'Select Service'; e.g. 'Book a Service')
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

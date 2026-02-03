import { Timestamp } from 'firebase/firestore';

export interface Service {
    id: string;
    name: string;
    description: string;
    durationMinutes: number;
    price: number;
    currency: string;
    isActive: boolean;
    imageUrl?: string;
    category?: string;
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
    createdAt: Timestamp;
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

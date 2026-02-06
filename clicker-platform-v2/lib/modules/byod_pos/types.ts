import { Timestamp } from 'firebase/firestore';

export interface ProductVariant {
    id: string;
    name: string;
    price: number;
    inventoryId?: string; // Specific inventory link for this variant
}

export interface CartItem {
    productId: string;
    variantId?: string; // New: optional variant ID
    inventoryId?: string; // If linked 1:1 (from product or variant)
    name: string;
    price: number;
    quantity: number;
    image?: string;
    variantName?: string;
    // KDS Fields
    notes?: string;
    modifiers?: string[]; // e.g., ["Rare", "No Onions"]
}

export interface POSOrder {
    id: string;
    items: CartItem[];
    total: number;
    status: 'open' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    customerName?: string;
    tableNumber?: string;
    orderType?: 'dine-in' | 'takeaway' | 'delivery'; // New Field
    createdAt: Timestamp;
    memberId?: string;
    memberName?: string;
    pointsEarned?: number;
    // Payment Fields
    paymentStatus?: 'unpaid' | 'pending_confirmation' | 'paid';
    paymentMethod?: 'cash' | 'card' | 'qris' | 'other';
    taxBreakdown?: TaxBreakdown;
}

export interface TaxSettings {
    serviceCharge: {
        enabled: boolean;
        rate: number; // Percentage (e.g., 10 for 10%)
    };
    restaurantTax: {
        enabled: boolean;
        rate: number; // Percentage (e.g., 10 for 10%)
    };
}

export interface TaxBreakdown {
    subtotal: number;
    serviceCharge: number;
    restaurantTax: number;
    total: number;
    serviceChargeRate: number;
    restaurantTaxRate: number;
}

export interface POSSettings {
    mode: 'open-bill' | 'fast-checkout';
    paymentMethods: {
        cash: boolean;
        card: boolean;
        qris: boolean;
    };
    taxSettings?: TaxSettings;
    requireTableNumber: boolean;
    categories?: string[]; // List of active categories for filtering
    businessDayStartHour?: number; // Hour of the day when the business day starts (e.g., 4 for 4 AM)

    // Branding
    businessName?: string;
    businessAddress?: string;
}

export interface POSItem {
    id: string;
    name: string;
    price: number;
    category: string;
    description?: string;
    imageUrl?: string;
    images?: string[];
    isActive?: boolean;
    variants?: ProductVariant[];
}

export interface POSStaffMember {
    userId: string;
    email: string;
    name: string;
    role: string;
    assignedAt: string | Date;
}

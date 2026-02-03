import { Timestamp } from 'firebase/firestore';

export interface Member {
    id: string; // Internal Doc ID
    uid?: string; // Linked Firebase Auth UID (Primary for Login)
    phoneNumber: string; // Unique Identifier for Loyalty/POS
    email: string; // Unique Identifier for Magic Link Login
    fullName: string;
    currentPoints: number;

    // Auth & Security
    role?: 'owner' | 'staff' | 'member'; // Added for RBAC checks in Security Rules
    pinHash?: string; // Legacy/Dev Only. 

    // Stats
    totalSpent: number;
    totalTransactions: number;

    // Metadata
    createdAt: Timestamp;
    updatedAt: Timestamp;

    // Template & Theme
    templateConfig?: {
        activeTemplateId: string; // The ID of the generic template to use
        hasCustomConfig: boolean; // If true, look for 'customConfig'
        // We use 'any' for now to avoid circular dependency with ThemeConfig if it's in a different package,
        // but ideally import { ThemeConfig } from '@/lib/templates/types'
        customConfig?: any;
        unlockedTemplates: string[]; // List of IDs (e.g., ['classic', 'modern', 'premium-gold'])
    };
}

export interface LoyaltyTransaction {
    id: string;
    memberId: string;

    // Source of the transaction
    source: string; // e.g., 'POS', 'RESERVATION', 'MANUAL', 'EVENTS'
    sourceRefId: string; // e.g., Order ID, Booking ID

    // Value
    pointsDelta: number; // Positive = Earning, Negative = Redemption
    spendAmount?: number; // Optional: Amount spent in this transaction
    description: string; // e.g., "Earned from Booking #123"

    createdAt: Timestamp; // Using Firestore Timestamp
}

export interface MembershipSettings {
    enableLoyalty: boolean;
    pointsName: string; // e.g., "Points", "Stars", "Coins"
    currency?: string; // e.g., "$", "IDR", "€"
    earningRatio: number; // Points per 1 Currency Unit
    spendBlock?: number; // UI Helper: The "Y" in "X points per Y spent". Persists the user's preferred denominator.

    // Derived/Runtime
    updatedAt?: Timestamp;
}

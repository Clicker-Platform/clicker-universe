import { Timestamp } from 'firebase/firestore';

// --- Tier System ---

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface TierThreshold {
    tier: Tier;
    minPoints: number;
}

export const DEFAULT_TIER_THRESHOLDS: TierThreshold[] = [
    { tier: 'Platinum', minPoints: 4000 },
    { tier: 'Gold',     minPoints: 1500 },
    { tier: 'Silver',   minPoints: 500  },
    { tier: 'Bronze',   minPoints: 0    },
];

export const TIER_COLORS: Record<Tier, { bg: string; text: string; border: string }> = {
    Platinum: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-700' },
    Gold:     { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-700' },
    Silver:   { bg: 'bg-slate-100 dark:bg-slate-800',      text: 'text-slate-600 dark:text-slate-300',   border: 'border-slate-200 dark:border-slate-600'  },
    Bronze:   { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-300',   border: 'border-amber-200 dark:border-amber-700'  },
};

export function getTier(points: number, thresholds: TierThreshold[] = DEFAULT_TIER_THRESHOLDS): Tier {
    for (const t of thresholds) {
        if (points >= t.minPoints) return t.tier;
    }
    return 'Bronze';
}

// --- Member ---

export interface Member {
    id: string; // Internal Doc ID
    uid?: string; // Linked Firebase Auth UID (Primary for Login)
    phoneNumber: string; // Unique Identifier for Loyalty/POS
    email: string; // Unique Identifier for Magic Link Login
    fullName: string;
    currentPoints: number;
    memberCode?: string; // e.g. "CLK-001" — assigned on creation, optional for legacy members

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

    // Member Code
    memberCodePrefix?: string; // e.g. "CLK" — used as prefix for new member codes. Defaults to "MBR"

    // Tier Thresholds (admin-configurable, falls back to DEFAULT_TIER_THRESHOLDS)
    tierThresholds?: TierThreshold[];

    // Derived/Runtime
    updatedAt?: Timestamp;
}

export interface MembershipStaffMember {
    userId: string;
    email: string;
    name: string;
    role: string;
    assignedAt: string | Date;
}

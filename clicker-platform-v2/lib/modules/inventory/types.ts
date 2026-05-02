import { Timestamp } from 'firebase/firestore';

export interface InventoryItem {
    id: string;
    sku: string;
    name: string;
    currentStock: number;
    lowStockThreshold: number;
    unit: string; // e.g., "pcs", "bottle", "serving"
    costPrice?: number;

    // Optional link to public product for auto-deduction later
    linkedProductId?: string; // Legacy
    linkedPosItemId?: string; // Link to POS Menu Item

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    archivedAt?: Timestamp;
}

export type TransactionReason = "purchase" | "sale" | "adjustment" | "waste" | "return";

export interface StockTransaction {
    id: string;
    itemId: string;
    itemName: string; // Denormalized for easier history display
    change: number; // Positive for addition, negative for deduction
    reason: TransactionReason;
    referenceId?: string; // OrderID or PO Number
    notes?: string;
    performedBy?: string; // User ID or Name
    timestamp: Timestamp;
}

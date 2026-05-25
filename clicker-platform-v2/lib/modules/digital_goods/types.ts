import { Timestamp } from 'firebase/firestore';

// --- Product ---

export type ProductType = 'single'; // Plan 1. Future: 'single' | 'bundle' | 'course'
export type ContentKind = 'pdf' | 'youtube';
export type ProductStatus = 'draft' | 'published';

export interface PdfFile {
  id: string;
  kind: 'pdf';
  name: string;          // original filename
  storagePath: string;   // Firebase Storage path (not URL)
  sizeBytes: number;
  mimeType: string;
}

export interface YouTubeFile {
  id: string;
  kind: 'youtube';
  url: string;           // canonical youtube.com/watch?v=... URL
  title?: string;        // optional display label
}

export type ProductFile = PdfFile | YouTubeFile;

export interface DigitalProduct {
  id: string;
  type: ProductType;
  title: string;
  description: string;          // markdown supported
  coverImage?: string;          // Full URL (from MediaPicker)
  price: number;                // integer IDR
  currency: 'IDR';
  contentKind: ContentKind;
  files: ProductFile[];         // Plan 1: length === 1
  slug: string;                 // URL-safe, unique per site
  status: ProductStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

// --- Order (Plan 2 — shape declared here so api/types co-evolve) ---

export type OrderStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'paid'
  | 'cancelled';

export type PaymentMethod = 'manual_transfer'; // Plan 1. Future: | 'midtrans' | 'xendit'

export interface PaymentInstructions {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisImageUrl?: string;
}

export interface ProductSnapshot {
  title: string;
  coverImage?: string;
  price: number;
  currency: 'IDR';
  contentKind: ContentKind;
  type: ProductType;
}

export interface DigitalOrder {
  id: string;
  buyerId: string;                // FK to sites/{siteId}/modules/digital_goods/buyers/{uid}
  productId: string;
  productSnapshot: ProductSnapshot;
  amount: number;
  currency: 'IDR';
  paymentMethod: PaymentMethod;
  paymentInstructions: PaymentInstructions;
  status: OrderStatus;
  buyerNote?: string;
  paymentRef?: string;
  confirmedBy?: string;
  confirmedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Library Entry (Plan 2) ---

export interface LibraryEntrySnapshot {
  title: string;
  coverImage?: string;
  type: ProductType;
  contentKind: ContentKind;
}

export interface LibraryEntry {
  id: string;
  buyerId: string;                // FK to sites/{siteId}/modules/digital_goods/buyers/{uid}
  productId: string;
  orderId: string;
  productSnapshot: LibraryEntrySnapshot;
  purchasedAt: Timestamp;
}

// --- Buyer Identity (Plan 2 — auto-provisioned on first authed visit) ---

export interface DigitalGoodsBuyer {
  uid: string;                    // matches doc ID; Firebase Auth UID
  email: string;
  fullName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Settings ---

export interface DigitalGoodsSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisImageUrl?: string;        // Firebase Storage path
  updatedAt?: Timestamp;
}

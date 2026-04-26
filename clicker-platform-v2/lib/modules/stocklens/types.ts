import { Timestamp } from 'firebase/firestore';
import { CATEGORY_CODES } from './constants';

export type ItemCondition = 'BNIB' | 'BNOB' | 'SECOND' | 'BROKEN';
export type CategoryCode = typeof CATEGORY_CODES[number];

export interface VaultSKU {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: CategoryCode;
  series?: string;
  releasePrice: number;
  aiAnalysis: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VaultUnit {
  id: string;
  skuId: string;
  condition: ItemCondition;
  marketPrice: number;
  photoUrl: string;
  year?: string;
  notes?: string;
  createdAt: Timestamp;
}

export interface ScanResult {
  name: string;
  brand: string;
  category: CategoryCode;
  sku: string;
  series?: string;
  releasePrice: number;
  marketPrice: number;
  suggestedCondition: ItemCondition;
  aiAnalysis: string;
}

import type { Timestamp } from 'firebase/firestore';

export type BusinessType =
  | 'fnb'
  | 'auto-detailing'
  | 'beauty-spa'
  | 'retail'
  | 'service'
  | 'other';

export type RegistrationStatus =
  | 'pending'
  | 'contacted'
  | 'activated'
  | 'rejected';

export interface Bundle {
  id: string;
  name: string;
  description: string;
  modules: string[];
}

export interface RegistrationRequest {
  id: string;

  name: string;
  email: string;
  phone: string;

  businessName: string;
  businessType: BusinessType;
  city: string;
  expectedOutlets: number;

  bundle: string | null;
  modules: string[];
  customRequest: string;
  promoCode: string | null;
  promoCodeValidAtSubmit: boolean;

  status: RegistrationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  activatedSiteId: string | null;
  activatedAt: Timestamp | null;
  rejectionReason: string | null;

  internalNotes: string;
  source: string | null;
}

export type RegistrationRequestInput = Omit<
  RegistrationRequest,
  | 'id'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'activatedSiteId'
  | 'activatedAt'
  | 'rejectionReason'
  | 'internalNotes'
>;

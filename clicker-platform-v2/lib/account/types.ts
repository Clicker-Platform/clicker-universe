import type { Timestamp } from 'firebase/firestore';
import type { AccentPresetId } from './accent';

export type AccountStatus = 'pending' | 'active';
export type AccountCreatedVia = 'register' | 'purchase';

export interface Account {
  uid: string;            // matches doc id; Firebase Auth UID
  email: string;
  fullName?: string;
  status: AccountStatus;        // 'pending' until first real login, then 'active'
  createdVia: AccountCreatedVia;
  accentPreset?: AccentPresetId; // member-chosen dashboard accent; unset → DEFAULT_ACCENT_PRESET ('coral')
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

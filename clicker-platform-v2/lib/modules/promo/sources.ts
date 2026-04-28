// lib/modules/promo/sources.ts
import { PromoSource } from './types';

export const PROMO_SOURCES: Record<PromoSource, { label: string; icon: string; moduleKey: string }> = {
  POS:         { label: 'POS',         icon: 'shopping-bag', moduleKey: 'byod_pos' },
  RESERVATION: { label: 'Reservation', icon: 'calendar',     moduleKey: 'reservation' },
  SERVICE:     { label: 'Service',     icon: 'wrench',       moduleKey: 'service_records' },
  OTHER:       { label: 'Other',       icon: 'tag',          moduleKey: 'other' },
};

export const PROMO_SOURCE_KEYS = Object.keys(PROMO_SOURCES) as PromoSource[];

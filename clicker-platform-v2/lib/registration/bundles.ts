import type { Bundle } from './types';

export const BUNDLES: Bundle[] = [
  {
    id: 'restaurant-starter',
    name: 'Restaurant Starter',
    description: 'Self-order POS + stock management for cafés and restaurants.',
    modules: ['byod_pos', 'inventory'],
  },
  {
    id: 'auto-detailing',
    name: 'Auto Detailing Pro',
    description: 'Service records, warranty cards, and loyalty for detailing shops.',
    modules: ['service_records', 'membership', 'promo'],
  },
  {
    id: 'beauty-spa',
    name: 'Beauty / Spa',
    description: 'Bookings, member loyalty, and promos for beauty salons and spas.',
    modules: ['reservation', 'membership', 'promo'],
  },
];

export function getBundleById(id: string): Bundle | undefined {
  return BUNDLES.find((b) => b.id === id);
}

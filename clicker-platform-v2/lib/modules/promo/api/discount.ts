import { PromoKind } from '../types';

export interface DiscountInput {
  kind: PromoKind;
  value: number;
  maxDiscount?: number;
}

export function calculateDiscount(input: DiscountInput, subtotal: number): number {
  if (subtotal <= 0) return 0;
  let raw = input.kind === 'percent'
    ? (subtotal * input.value) / 100
    : input.value;
  if (input.maxDiscount !== undefined && raw > input.maxDiscount) raw = input.maxDiscount;
  if (raw > subtotal) raw = subtotal;
  return Math.floor(raw);
}

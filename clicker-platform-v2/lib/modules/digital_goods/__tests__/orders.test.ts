import { describe, it, expect } from 'vitest';
import { canTransition, OrderStatus } from '../orders';

describe('canTransition', () => {
  it('allows pending → awaiting_confirmation', () => {
    expect(canTransition('pending', 'awaiting_confirmation')).toBe(true);
  });

  it('allows awaiting_confirmation → paid', () => {
    expect(canTransition('awaiting_confirmation', 'paid')).toBe(true);
  });

  it('allows awaiting_confirmation → cancelled', () => {
    expect(canTransition('awaiting_confirmation', 'cancelled')).toBe(true);
  });

  it('blocks paid → cancelled (no refunds in MVP)', () => {
    expect(canTransition('paid', 'cancelled')).toBe(false);
  });

  it('blocks paid → awaiting_confirmation', () => {
    expect(canTransition('paid', 'awaiting_confirmation')).toBe(false);
  });

  it('blocks cancelled → paid', () => {
    expect(canTransition('cancelled', 'paid')).toBe(false);
  });

  it('blocks pending → paid (must go through awaiting_confirmation first)', () => {
    expect(canTransition('pending', 'paid')).toBe(false);
  });
});

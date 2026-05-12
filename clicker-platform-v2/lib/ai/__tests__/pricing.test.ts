import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));

describe('pricing', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('calculateCost — fallback rates', () => {
    it('calculates cost using fallback rate when Firestore table empty', async () => {
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ data: () => undefined }) })),
      } as never);

      const { calculateCost } = await import('../pricing');
      // google/gemma-4-27b-it:free → both rates = 0
      const cost = await calculateCost('google/gemma-4-27b-it:free', 100_000, 50_000);
      expect(cost).toBe(0);
    });

    it('calculates cost for paid model using fallback rate', async () => {
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ data: () => undefined }) })),
      } as never);

      const { calculateCost } = await import('../pricing');
      // deepseek/deepseek-v4-flash: input $0.14/1M, output $0.28/1M
      const cost = await calculateCost('deepseek/deepseek-v4-flash', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(0.14 + 0.28, 6);
    });

    it('uses Firestore override rate when present', async () => {
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            data: () => ({
              models: {
                'deepseek/deepseek-v4-flash': { inputPer1M: 1.00, outputPer1M: 2.00 },
              },
            }),
          }),
        })),
      } as never);

      const { calculateCost } = await import('../pricing');
      const cost = await calculateCost('deepseek/deepseek-v4-flash', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(3.00, 6);
    });

    it('throws model_not_priced when model unknown and not in fallback', async () => {
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ data: () => undefined }) })),
      } as never);

      const { calculateCost } = await import('../pricing');
      await expect(calculateCost('unknown/model-xyz', 1000, 1000))
        .rejects.toThrow('model_not_priced:unknown/model-xyz');
    });
  });

  describe('invalidatePricingCache', () => {
    it('forces fresh Firestore read after invalidation', async () => {
      const mockGet = vi.fn()
        .mockResolvedValueOnce({ data: () => ({ models: { 'deepseek/deepseek-v4-flash': { inputPer1M: 9.99, outputPer1M: 9.99 } } }) })
        .mockResolvedValueOnce({ data: () => ({ models: { 'deepseek/deepseek-v4-flash': { inputPer1M: 1.00, outputPer1M: 1.00 } } }) });

      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({ get: mockGet })),
      } as never);

      const { calculateCost, invalidatePricingCache } = await import('../pricing');

      const cost1 = await calculateCost('deepseek/deepseek-v4-flash', 1_000_000, 0);
      expect(cost1).toBeCloseTo(9.99, 4);

      invalidatePricingCache();

      const cost2 = await calculateCost('deepseek/deepseek-v4-flash', 1_000_000, 0);
      expect(cost2).toBeCloseTo(1.00, 4);
    });
  });
});

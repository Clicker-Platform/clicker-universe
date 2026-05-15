import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTransaction = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockBatch = vi.fn(() => ({
  update: vi.fn(),
  set: vi.fn(),
  commit: mockBatchCommit,
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
  FieldValue: {
    increment: vi.fn((n: number) => ({ _increment: n })),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  },
}));


function makeDb(balanceData: { exists: boolean; balance?: number; lifetimeUsed?: number }) {
  const creditDoc = {
    exists: balanceData.exists,
    data: () =>
      balanceData.exists
        ? { balance: balanceData.balance ?? 0, lifetimeUsed: balanceData.lifetimeUsed ?? 0 }
        : undefined,
  };

  const txGet = vi.fn().mockResolvedValue(creditDoc);
  const txUpdate = vi.fn();
  const txSet = vi.fn();

  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn({ get: txGet, update: txUpdate, set: txSet });
  });

  // ledgerCol: db.collection('sites').doc(siteId).collection('platform').doc('aiCreditLedger').collection('entries')
  const entriesCol = { doc: vi.fn(() => ({ id: 'ledger-entry' })) };
  const aiCreditLedgerDoc = { collection: vi.fn(() => entriesCol) };
  const platformCol = { doc: vi.fn(() => aiCreditLedgerDoc) };
  const siteDoc = { collection: vi.fn(() => platformCol) };
  const sitesCol = { doc: vi.fn(() => siteDoc) };

  return {
    db: {
      doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue(creditDoc) })),
      collection: vi.fn(() => sitesCol),
      runTransaction: mockTransaction,
      batch: mockBatch,
    },
    txUpdate,
    txSet,
    txGet,
  };
}

describe('credits', () => {
  beforeEach(() => {
    vi.resetModules();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  describe('deductCredits', () => {
    it('returns balanceAfter when balance sufficient', async () => {
      const { db, txUpdate } = makeDb({ exists: true, balance: 1.0 });
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue(db as never);

      const { deductCredits } = await import('../credits');
      const result = await deductCredits('site-1', 0.25, {
        moduleId: 'ai_marketing', skillId: 'generate_ad_copy',
        uid: 'user-1', model: 'qwen/qwen3.5-flash',
        inputTokens: 1000, outputTokens: 500,
      });

      expect(result.balanceAfter).toBeCloseTo(0.75, 5);
      expect(txUpdate).toHaveBeenCalled();
    });

    it('throws insufficient_credits when balance < cost', async () => {
      const { db } = makeDb({ exists: true, balance: 0.10 });
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue(db as never);

      const { deductCredits } = await import('../credits');
      await expect(
        deductCredits('site-1', 0.50, {
          moduleId: 'ai_marketing', skillId: 'generate_ad_copy',
          uid: 'user-1', model: 'qwen/qwen3.5-flash',
          inputTokens: 1000, outputTokens: 500,
        })
      ).rejects.toThrow('insufficient_credits:0.1:0.5');
    });

    it('throws insufficient_credits when doc does not exist', async () => {
      const { db } = makeDb({ exists: false });
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue(db as never);

      const { deductCredits } = await import('../credits');
      await expect(
        deductCredits('site-1', 0.10, {
          moduleId: 'ai_sales_agent', skillId: 'chat',
          uid: 'public', model: 'deepseek/deepseek-v4-flash',
          inputTokens: 500, outputTokens: 200,
        })
      ).rejects.toThrow('insufficient_credits:0:');
    });
  });

  describe('getCreditBalance', () => {
    it('returns balance and lifetimeUsed from Firestore', async () => {
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ balance: 2.5, lifetimeUsed: 7.3 }),
          }),
        })),
      } as never);

      const { getCreditBalance } = await import('../credits');
      const result = await getCreditBalance('site-1');
      expect(result.balance).toBe(2.5);
      expect(result.lifetimeUsed).toBe(7.3);
    });

    it('returns zeros when doc missing', async () => {
      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        })),
      } as never);

      const { getCreditBalance } = await import('../credits');
      const result = await getCreditBalance('site-new');
      expect(result.balance).toBe(0);
      expect(result.lifetimeUsed).toBe(0);
    });
  });

  describe('addCredits', () => {
    it('returns correct balanceAfter when doc exists', async () => {
      const txGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ balance: 1.0, lifetimeUsed: 5.0 }),
      });
      const txUpdate = vi.fn();
      const txSet = vi.fn();

      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({ get: txGet, update: txUpdate, set: txSet });
      });

      const entriesCol = { doc: vi.fn(() => ({})) };
      const aiCreditLedgerDoc = { collection: vi.fn(() => entriesCol) };
      const platformCol = { doc: vi.fn(() => aiCreditLedgerDoc) };
      const siteDoc = { collection: vi.fn(() => platformCol) };
      const sitesCol = { doc: vi.fn(() => siteDoc) };

      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({})),
        collection: vi.fn(() => sitesCol),
        runTransaction: mockTransaction,
      } as never);

      const { addCredits } = await import('../credits');
      const result = await addCredits('site-1', 5.0, { performedBy: 'admin', reason: 'manual topup' });
      expect(result.balanceAfter).toBeCloseTo(6.0, 5);
      expect(txUpdate).toHaveBeenCalled();
    });

    it('creates doc when it does not exist', async () => {
      const txGet = vi.fn().mockResolvedValue({ exists: false, data: () => undefined });
      const txSet = vi.fn();

      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({ get: txGet, set: txSet });
      });

      const entriesCol = { doc: vi.fn(() => ({})) };
      const aiCreditLedgerDoc = { collection: vi.fn(() => entriesCol) };
      const platformCol = { doc: vi.fn(() => aiCreditLedgerDoc) };
      const siteDoc = { collection: vi.fn(() => platformCol) };
      const sitesCol = { doc: vi.fn(() => siteDoc) };

      const { getFirestore } = await import('firebase-admin/firestore');
      vi.mocked(getFirestore).mockReturnValue({
        doc: vi.fn(() => ({})),
        collection: vi.fn(() => sitesCol),
        runTransaction: mockTransaction,
      } as never);

      const { addCredits } = await import('../credits');
      const result = await addCredits('site-new', 10.0, { performedBy: 'admin', reason: 'initial' });
      expect(result.balanceAfter).toBeCloseTo(10.0, 5);
      expect(txSet).toHaveBeenCalled();
    });
  });
});

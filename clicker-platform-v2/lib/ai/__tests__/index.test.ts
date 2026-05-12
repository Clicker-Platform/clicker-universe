import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../client', () => ({
  callText: vi.fn(),
  callVision: vi.fn(),
  callWithTools: vi.fn(),
}));

vi.mock('../credits', () => ({
  deductCredits: vi.fn(),
  getCreditBalance: vi.fn(),
}));

vi.mock('../pricing', () => ({
  calculateCost: vi.fn(),
}));

const OPTIONS = {
  siteId: 'site-test',
  moduleId: 'ai_marketing',
  skillId: 'generate_ad_copy',
  uid: 'user-1',
};

const MOCK_AI_RESULT = {
  content: 'Generated content',
  inputTokens: 1000,
  outputTokens: 500,
  model: 'qwen/qwen3.5-flash',
};

describe('invokeAI', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns content on success', async () => {
    const { getCreditBalance } = await import('../credits');
    const { callText } = await import('../client');
    const { calculateCost } = await import('../pricing');
    const { deductCredits } = await import('../credits');

    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 5.0, lifetimeUsed: 0 });
    vi.mocked(callText).mockResolvedValue(MOCK_AI_RESULT);
    vi.mocked(calculateCost).mockResolvedValue(0.001);
    vi.mocked(deductCredits).mockResolvedValue({ balanceAfter: 4.999 });

    const { invokeAI } = await import('../index');
    const result = await invokeAI(
      { model: 'qwen/qwen3.5-flash', messages: [{ role: 'user', content: 'hello' }] },
      OPTIONS
    );

    expect(result).toBe('Generated content');
    expect(deductCredits).toHaveBeenCalledWith('site-test', 0.001, expect.objectContaining({
      moduleId: 'ai_marketing',
      skillId: 'generate_ad_copy',
      model: 'qwen/qwen3.5-flash',
    }));
  });

  it('throws and logs ai.billing.insufficient when balance <= 0', async () => {
    const { getCreditBalance } = await import('../credits');
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 0, lifetimeUsed: 10 });

    const { logger } = await import('@/lib/logger');
    const { invokeAI } = await import('../index');

    await expect(invokeAI(
      { model: 'qwen/qwen3.5-flash', messages: [{ role: 'user', content: 'hello' }] },
      OPTIONS
    )).rejects.toThrow('insufficient_credits');

    expect(logger.error).toHaveBeenCalledWith('ai.billing.insufficient', expect.objectContaining({ siteId: 'site-test' }));
  });

  it('logs ai.pricing.model_not_priced when model unknown', async () => {
    const { getCreditBalance } = await import('../credits');
    const { callText } = await import('../client');
    const { calculateCost } = await import('../pricing');

    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 5.0, lifetimeUsed: 0 });
    vi.mocked(callText).mockResolvedValue({ ...MOCK_AI_RESULT, model: 'unknown/model-xyz' });
    vi.mocked(calculateCost).mockRejectedValue(new Error('model_not_priced:unknown/model-xyz'));

    const { logger } = await import('@/lib/logger');
    const { invokeAI } = await import('../index');

    // Should NOT throw — postDeduct absorbs the error
    await invokeAI(
      { model: 'unknown/model-xyz', messages: [{ role: 'user', content: 'hello' }] },
      OPTIONS
    );

    expect(logger.error).toHaveBeenCalledWith('ai.pricing.model_not_priced', expect.objectContaining({ siteId: 'site-test' }));
  });

  it('logs ai.billing.deduct.failed on unexpected deduct error', async () => {
    const { getCreditBalance } = await import('../credits');
    const { callText } = await import('../client');
    const { calculateCost } = await import('../pricing');
    const { deductCredits } = await import('../credits');

    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 5.0, lifetimeUsed: 0 });
    vi.mocked(callText).mockResolvedValue(MOCK_AI_RESULT);
    vi.mocked(calculateCost).mockResolvedValue(0.001);
    vi.mocked(deductCredits).mockRejectedValue(new Error('FIRESTORE_UNAVAILABLE'));

    const { logger } = await import('@/lib/logger');
    const { invokeAI } = await import('../index');

    await invokeAI(
      { model: 'qwen/qwen3.5-flash', messages: [{ role: 'user', content: 'hello' }] },
      OPTIONS
    );

    expect(logger.error).toHaveBeenCalledWith('ai.billing.deduct.failed', expect.objectContaining({ siteId: 'site-test' }));
  });
});

describe('invokeVision', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls callVision and deducts', async () => {
    const { getCreditBalance } = await import('../credits');
    const { callVision } = await import('../client');
    const { calculateCost } = await import('../pricing');
    const { deductCredits } = await import('../credits');

    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 5.0, lifetimeUsed: 0 });
    vi.mocked(callVision).mockResolvedValue({ ...MOCK_AI_RESULT, model: 'google/gemma-4-27b-it:free' });
    vi.mocked(calculateCost).mockResolvedValue(0);
    vi.mocked(deductCredits).mockResolvedValue({ balanceAfter: 5.0 });

    const { invokeVision } = await import('../index');
    const result = await invokeVision(
      { model: 'google/gemma-4-27b-it:free', messages: [{ role: 'user', content: [{ type: 'text', text: 'describe' }] }] },
      OPTIONS
    );

    expect(result).toBe('Generated content');
    expect(callVision).toHaveBeenCalled();
    expect(deductCredits).toHaveBeenCalledWith('site-test', 0, expect.any(Object));
  });
});

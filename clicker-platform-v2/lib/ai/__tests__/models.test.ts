import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe('models', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns ModelConfig with all slots mapped from llm + vision', async () => {
    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockReturnValue({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ llm: 'deepseek/deepseek-v4-flash', vision: 'google/gemma-4-27b-it:free' }),
        }),
      })),
    } as never);

    const { getModelConfig } = await import('../models');
    const config = await getModelConfig();

    expect(config.chat).toBe('deepseek/deepseek-v4-flash');
    expect(config.tools).toBe('deepseek/deepseek-v4-flash');
    expect(config.fast).toBe('deepseek/deepseek-v4-flash');
    expect(config.quality).toBe('deepseek/deepseek-v4-flash');
    expect(config.vision).toBe('google/gemma-4-27b-it:free');
  });

  it('throws model_config_not_set when Firestore doc missing', async () => {
    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockReturnValue({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      })),
    } as never);

    const { getModelConfig } = await import('../models');
    await expect(getModelConfig()).rejects.toThrow('model_config_not_set');
  });

  it('logs ai.billing.model_config_not_set when doc missing', async () => {
    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockReturnValue({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      })),
    } as never);

    const { logger } = await import('@/lib/logger');
    const { getModelConfig } = await import('../models');

    await getModelConfig().catch(() => {});
    expect(logger.error).toHaveBeenCalledWith('ai.billing.model_config_not_set', expect.any(Object));
  });

  it('throws model_config_incomplete when llm slot missing', async () => {
    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockReturnValue({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ vision: 'google/gemma-4-27b-it:free' }), // llm missing
        }),
      })),
    } as never);

    const { getModelConfig } = await import('../models');
    await expect(getModelConfig()).rejects.toThrow('model_config_incomplete');
  });

  it('throws model_config_incomplete when vision slot missing', async () => {
    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockReturnValue({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ llm: 'deepseek/deepseek-v4-flash' }), // vision missing
        }),
      })),
    } as never);

    const { getModelConfig } = await import('../models');
    await expect(getModelConfig()).rejects.toThrow('model_config_incomplete');
  });

  it('returns cached value on second call without Firestore read', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ llm: 'deepseek/deepseek-v4-flash', vision: 'google/gemma-4-27b-it:free' }),
    });

    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockReturnValue({
      doc: vi.fn(() => ({ get: mockGet })),
    } as never);

    const { getModelConfig } = await import('../models');
    await getModelConfig();
    await getModelConfig();

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('invalidateModelCache forces fresh read', async () => {
    const mockGet = vi.fn()
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ llm: 'model-v1', vision: 'vision-v1' }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ llm: 'model-v2', vision: 'vision-v2' }),
      });

    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockReturnValue({
      doc: vi.fn(() => ({ get: mockGet })),
    } as never);

    const { getModelConfig, invalidateModelCache } = await import('../models');

    const c1 = await getModelConfig();
    expect(c1.chat).toBe('model-v1');

    invalidateModelCache();

    const c2 = await getModelConfig();
    expect(c2.chat).toBe('model-v2');
  });

  it('getModel returns correct slot value', async () => {
    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockReturnValue({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ llm: 'qwen/qwen3.5-flash', vision: 'google/gemma-4-27b-it:free' }),
        }),
      })),
    } as never);

    const { getModel } = await import('../models');
    expect(await getModel('chat')).toBe('qwen/qwen3.5-flash');
    expect(await getModel('vision')).toBe('google/gemma-4-27b-it:free');
  });
});

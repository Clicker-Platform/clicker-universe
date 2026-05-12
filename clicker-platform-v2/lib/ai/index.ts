import { callText, callVision, callWithTools } from './client';
import type { AIResult, AIToolResult } from './client';
import { deductCredits, getCreditBalance } from './credits';
import { calculateCost } from './pricing';
import type { AIRequest, VisionRequest, ToolRequest, AICallOptions } from './types';
import { logger } from '@/lib/logger';

export { buildTenantContext, invalidateTenantContext } from './context';
export { getModel, getModelConfig, invalidateModelCache } from './models';
export { calculateCost, invalidatePricingCache } from './pricing';
export type { AIRequest, VisionRequest, ToolRequest, AICallOptions, ModelConfig, TenantContext, ContextEnrichment, AIUsageResult } from './types';
export type { AIResult, AIToolResult } from './client';
export type { ToolCall, ToolDefinition } from './types';

async function preflightCheck(siteId: string): Promise<void> {
  const { balance } = await getCreditBalance(siteId);
  if (balance <= 0) {
    logger.error('ai.billing.insufficient', { siteId, balance, costUSD: 0 });
    throw new Error(`insufficient_credits:${balance}:0`);
  }
}

async function postDeduct(
  result: AIResult | AIToolResult,
  options: AICallOptions
): Promise<void> {
  const { siteId, moduleId, skillId, uid } = options;
  const { inputTokens, outputTokens, model } = result;
  try {
    const costUSD = await calculateCost(model, inputTokens, outputTokens);
    await deductCredits(siteId, costUSD, { moduleId, skillId, uid, model, inputTokens, outputTokens });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('insufficient_credits:')) {
      logger.error('ai.billing.insufficient', { siteId, moduleId, skillId, model, error: msg });
      return;
    }
    if (msg.startsWith('model_not_priced:')) {
      logger.error('ai.pricing.model_not_priced', { siteId, moduleId, skillId, model, error: msg });
      return;
    }
    logger.error('ai.billing.deduct.failed', { siteId, moduleId, skillId, model, error: msg });
  }
}

export async function invokeAI(
  request: AIRequest,
  options: AICallOptions
): Promise<string> {
  await preflightCheck(options.siteId);
  const result = await callText(request);
  await postDeduct(result, options);
  return result.content;
}

export async function invokeVision(
  request: VisionRequest,
  options: AICallOptions
): Promise<string> {
  await preflightCheck(options.siteId);
  const result = await callVision(request);
  await postDeduct(result, options);
  return result.content;
}

export async function invokeWithTools(
  request: ToolRequest,
  options: AICallOptions
): Promise<AIToolResult> {
  await preflightCheck(options.siteId);
  const result = await callWithTools(request);
  await postDeduct(result, options);
  return result;
}

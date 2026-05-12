import { callText, callVision, callWithTools } from './client';
import { deductCredits, refundCredits } from './credits';
import type { AIRequest, VisionRequest, ToolRequest, ToolResponse, AICallOptions } from './types';

export { buildTenantContext, invalidateTenantContext } from './context';
export { getModel, getModelConfig, invalidateModelCache } from './models';
export type { AIRequest, VisionRequest, ToolRequest, ToolResponse, ToolCall, ToolDefinition, AICallOptions, ModelConfig, TenantContext, ContextEnrichment } from './types';

async function withCredits<T>(
  options: AICallOptions,
  fn: () => Promise<T>
): Promise<T> {
  const { siteId, moduleId, skillId, creditCost, uid } = options;
  await deductCredits(siteId, creditCost, { moduleId, skillId, uid });
  try {
    return await fn();
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Unknown AI error';
    await refundCredits(siteId, creditCost, { moduleId, skillId, reason });
    throw err;
  }
}

export async function invokeAI(
  request: AIRequest,
  options: AICallOptions
): Promise<string> {
  return withCredits(options, () => callText(request));
}

export async function invokeVision(
  request: VisionRequest,
  options: AICallOptions
): Promise<string> {
  return withCredits(options, () => callVision(request));
}

export async function invokeWithTools(
  request: ToolRequest,
  options: AICallOptions
): Promise<ToolResponse> {
  return withCredits(options, () => callWithTools(request));
}

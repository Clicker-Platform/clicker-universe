// Platform-level OpenRouter client — shared across all AI modules (ai_marketing, ai_sales, etc.)
// API key stored at: modules/ai-platform/private/config → { openRouterApiKey }

import { getFirestore } from 'firebase-admin/firestore';
import { deductCredits, refundCredits } from './credits';

// Legacy wrapper — migrate callers to lib/ai/index.ts invokeAI then delete this file
interface OpenRouterRequest {
  model: string;
  messages: { role: string; content: string | unknown[] }[];
  max_tokens?: number;
  temperature?: number;
}

interface OpenRouterCallOptions {
  siteId: string;
  moduleId: string;
  skillId: string;
  creditCost: number;
  uid: string;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function getApiKey(): Promise<string> {
  const db = getFirestore();
  const configDoc = await db.doc('modules/ai-platform/private/config').get();
  const key = configDoc.data()?.openRouterApiKey;
  if (!key) throw new Error('OpenRouter API key not configured. Set modules/ai-platform/private/config.openRouterApiKey');
  return key;
}

/**
 * Main AI invocation function. Handles credit deduction, API call, and refund on failure.
 *
 * Flow:
 * 1. Deduct credits (atomic transaction — throws if insufficient)
 * 2. Call OpenRouter API
 * 3. If success → return response text
 * 4. If failure → refund credits → throw error
 */
export async function invokeAI(
  request: OpenRouterRequest,
  options: OpenRouterCallOptions
): Promise<string> {
  const { siteId, moduleId, skillId, creditCost, uid } = options;

  // 1. Atomic credit deduction
  await deductCredits(siteId, creditCost, { moduleId, skillId, uid });

  let apiKey: string;
  try {
    apiKey = await getApiKey();
  } catch (err: any) {
    // Config error — refund immediately
    await refundCredits(siteId, creditCost, { moduleId, skillId, reason: err.message });
    throw err;
  }

  // 2. Call OpenRouter
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://clicker.id',
        'X-Title': 'Clicker Platform',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens ?? 2048,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenRouter returned empty response');
    }

    return typeof content === 'string' ? content : JSON.stringify(content);
  } catch (err: any) {
    // 3. Refund on failure
    await refundCredits(siteId, creditCost, {
      moduleId,
      skillId,
      reason: err.message ?? 'Unknown AI error',
    });
    throw err;
  }
}

/**
 * Checks if sufficient credits are available without deducting.
 * Use for pre-flight client-side check only. Server always uses deductCredits transaction.
 */
export async function checkSufficientCredits(siteId: string, required: number): Promise<boolean> {
  const db = getFirestore();
  const doc = await db.doc(`sites/${siteId}/platform/aiCredits`).get();
  const balance = doc.data()?.balance ?? 0;
  return balance >= required;
}

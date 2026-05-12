import { getFirestore } from 'firebase-admin/firestore';

const PRICING_DOC = 'modules/ai-platform/config/pricing';
const TTL_MS = 5 * 60 * 1000;

interface ModelRate {
  inputPer1M: number;
  outputPer1M: number;
}

let pricingCache: { value: Record<string, ModelRate>; expiresAt: number } | null = null;

export async function getPricingTable(): Promise<Record<string, ModelRate>> {
  if (pricingCache && Date.now() < pricingCache.expiresAt) return pricingCache.value;

  const db = getFirestore();
  const doc = await db.doc(PRICING_DOC).get();
  const value = (doc.data()?.models as Record<string, ModelRate>) ?? {};
  pricingCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export async function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const table = await getPricingTable();
  const rate = table[model];
  if (!rate) throw new Error(`model_not_priced:${model}`);
  return (inputTokens / 1_000_000) * rate.inputPer1M + (outputTokens / 1_000_000) * rate.outputPer1M;
}

export function invalidatePricingCache(): void {
  pricingCache = null;
}

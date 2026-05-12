import { getFirestore } from 'firebase-admin/firestore';
import type { ModelConfig } from './types';
import { logger } from '@/lib/logger';

const MODELS_DOC = 'modules/ai-platform/config/models';
const TTL_MS = 5 * 60 * 1000;

// Firestore stores: llm, vision
// ModelConfig exposes: chat, tools, fast, quality (→ llm), vision (→ vision)
interface FirestoreModelDoc {
  llm: string;
  vision: string;
}

let configCache: { value: ModelConfig; expiresAt: number } | null = null;

export async function getModelConfig(): Promise<ModelConfig> {
  if (configCache && Date.now() < configCache.expiresAt) return configCache.value;

  const db = getFirestore();
  const doc = await db.doc(MODELS_DOC).get();

  if (!doc.exists) {
    logger.error('ai.billing.model_config_not_set', { siteId: 'platform' });
    throw new Error('model_config_not_set: configure models in Backyard → AI Settings → Models');
  }

  const data = doc.data() as Partial<FirestoreModelDoc>;
  if (!data.llm || !data.vision) {
    logger.error('ai.billing.model_config_incomplete', { siteId: 'platform', llm: !!data.llm, vision: !!data.vision });
    throw new Error('model_config_incomplete: llm and vision slots must all be set in Backyard → AI Settings → Models');
  }

  const value: ModelConfig = {
    chat:    data.llm,
    tools:   data.llm,
    fast:    data.llm,
    quality: data.llm,
    vision:  data.vision,
  };

  configCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export async function getModel(useCase: keyof ModelConfig): Promise<string> {
  const config = await getModelConfig();
  return config[useCase];
}

export function invalidateModelCache(): void {
  configCache = null;
}

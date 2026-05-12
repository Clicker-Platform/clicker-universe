import type { ModelConfig } from './types';
import { logger } from '@/lib/logger';
import { adminDb } from '@/lib/firebase-admin';

const MODELS_DOC = 'modules/ai-platform/config/models';

interface FirestoreModelDoc {
  llm: string;
  vision: string;
}

export async function getModelConfig(): Promise<ModelConfig> {
  const db = adminDb;
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

  return {
    chat:    data.llm,
    tools:   data.llm,
    fast:    data.llm,
    quality: data.llm,
    vision:  data.vision,
  };
}

export async function getModel(useCase: keyof ModelConfig): Promise<string> {
  const config = await getModelConfig();
  return config[useCase];
}

export function invalidateModelCache(): void {
  // no-op: cache removed, reads are always fresh
}

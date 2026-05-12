import { getFirestore } from 'firebase-admin/firestore';
import type { ModelConfig } from './types';

const MODELS_DOC = 'modules/ai-platform/config/models';
const TTL_MS = 5 * 60 * 1000;

const FALLBACK: ModelConfig = {
  chat:    'google/gemini-2.0-flash',
  vision:  'google/gemini-2.0-flash',
  tools:   'google/gemini-2.0-flash',
  fast:    'google/gemini-2.0-flash-lite',
  quality: 'anthropic/claude-sonnet-4',
};

let configCache: { value: ModelConfig; expiresAt: number } | null = null;

export async function getModelConfig(): Promise<ModelConfig> {
  if (configCache && Date.now() < configCache.expiresAt) return configCache.value;

  try {
    const db = getFirestore();
    const doc = await db.doc(MODELS_DOC).get();
    if (doc.exists) {
      const value = { ...FALLBACK, ...(doc.data() as Partial<ModelConfig>) };
      configCache = { value, expiresAt: Date.now() + TTL_MS };
      return value;
    }
  } catch {
    // Fall through to defaults
  }

  return FALLBACK;
}

export async function getModel(useCase: keyof ModelConfig): Promise<string> {
  const config = await getModelConfig();
  return config[useCase];
}

export function invalidateModelCache(): void {
  configCache = null;
}

import { adminDb } from '@/lib/firebase-admin';

const PRICING_DOC = 'modules/ai-platform/config/pricing';
const TTL_MS = 5 * 60 * 1000;

interface ModelRate {
  inputPer1M: number;
  outputPer1M: number;
}

// OpenRouter published rates (as of 2026-05). Used as fallback when model not in Firestore pricing table.
const OPENROUTER_FALLBACK_RATES: Record<string, ModelRate> = {
  // Google
  'google/gemini-2.0-flash':                   { inputPer1M: 0.10,   outputPer1M: 0.40   },
  'google/gemini-2.0-flash:free':              { inputPer1M: 0,      outputPer1M: 0      },
  'google/gemini-2.0-flash-lite:free':         { inputPer1M: 0,      outputPer1M: 0      },
  'google/gemini-2.5-flash-preview':           { inputPer1M: 0.15,   outputPer1M: 0.60   },
  'google/gemini-2.5-pro':                     { inputPer1M: 1.25,   outputPer1M: 10.00  },
  'google/gemini-3.1-flash-lite':              { inputPer1M: 0.25,   outputPer1M: 1.50   },
  'google/gemini-flash-latest':                { inputPer1M: 0.50,   outputPer1M: 3.00   },
  'google/gemini-pro-latest':                  { inputPer1M: 2.00,   outputPer1M: 12.00  },
  'google/gemma-4-27b-it:free':               { inputPer1M: 0,      outputPer1M: 0      },
  // OpenAI
  'openai/gpt-4o-mini':                        { inputPer1M: 0.15,   outputPer1M: 0.60   },
  'openai/gpt-4o':                             { inputPer1M: 2.50,   outputPer1M: 10.00  },
  'openai/gpt-4.1-mini':                       { inputPer1M: 0.40,   outputPer1M: 1.60   },
  'openai/gpt-4.1':                            { inputPer1M: 2.00,   outputPer1M: 8.00   },
  'openai/o4-mini':                            { inputPer1M: 1.10,   outputPer1M: 4.40   },
  'openai/o3':                                 { inputPer1M: 10.00,  outputPer1M: 40.00  },
  'openai/gpt-5.4-nano':                       { inputPer1M: 0.20,   outputPer1M: 1.25   },
  'openai/gpt-5.4-mini':                       { inputPer1M: 0.75,   outputPer1M: 4.50   },
  'openai/gpt-5.4':                            { inputPer1M: 2.50,   outputPer1M: 15.00  },
  'openai/gpt-5.5':                            { inputPer1M: 5.00,   outputPer1M: 30.00  },
  // Anthropic
  'anthropic/claude-haiku-4-5':               { inputPer1M: 0.80,   outputPer1M: 4.00   },
  'anthropic/claude-haiku-latest':            { inputPer1M: 1.00,   outputPer1M: 5.00   },
  'anthropic/claude-sonnet-4':                { inputPer1M: 3.00,   outputPer1M: 15.00  },
  'anthropic/claude-sonnet-4-5':              { inputPer1M: 3.00,   outputPer1M: 15.00  },
  'anthropic/claude-sonnet-latest':           { inputPer1M: 3.00,   outputPer1M: 15.00  },
  'anthropic/claude-opus-4':                  { inputPer1M: 15.00,  outputPer1M: 75.00  },
  'anthropic/claude-opus-4.7':               { inputPer1M: 5.00,   outputPer1M: 25.00  },
  // DeepSeek
  'deepseek/deepseek-chat':                   { inputPer1M: 0.27,   outputPer1M: 1.10   },
  'deepseek/deepseek-chat:free':              { inputPer1M: 0,      outputPer1M: 0      },
  'deepseek/deepseek-r1':                     { inputPer1M: 0.55,   outputPer1M: 2.19   },
  'deepseek/deepseek-r1:free':               { inputPer1M: 0,      outputPer1M: 0      },
  'deepseek/deepseek-v4-flash':               { inputPer1M: 0.14,   outputPer1M: 0.28   },
  'deepseek/deepseek-v4-flash:free':          { inputPer1M: 0,      outputPer1M: 0      },
  'deepseek/deepseek-v4-pro':                 { inputPer1M: 0.44,   outputPer1M: 0.87   },
  // Qwen
  'qwen/qwen3-8b:free':                       { inputPer1M: 0,      outputPer1M: 0      },
  'qwen/qwen3-235b-a22b:free':               { inputPer1M: 0,      outputPer1M: 0      },
  'qwen/qwen3.5-9b':                          { inputPer1M: 0.04,   outputPer1M: 0.15   },
  'qwen/qwen3.5-9b:free':                    { inputPer1M: 0,      outputPer1M: 0      },
  'qwen/qwen3.5-flash':                       { inputPer1M: 0.065,  outputPer1M: 0.26   },
  'qwen/qwen3.5-plus-20260420':               { inputPer1M: 0.40,   outputPer1M: 2.40   },
  'qwen/qwen3.6-max-preview':                 { inputPer1M: 1.04,   outputPer1M: 6.24   },
  // Meta
  'meta-llama/llama-3.1-8b-instruct:free':   { inputPer1M: 0,      outputPer1M: 0      },
  'meta-llama/llama-3.3-70b-instruct':        { inputPer1M: 0.12,   outputPer1M: 0.30   },
  'meta-llama/llama-3.3-70b-instruct:free':   { inputPer1M: 0,      outputPer1M: 0      },
  'meta-llama/llama-4-scout':                 { inputPer1M: 0.17,   outputPer1M: 0.17   },
  'meta-llama/llama-4-maverick':              { inputPer1M: 0.22,   outputPer1M: 0.88   },
};

let pricingCache: { value: Record<string, ModelRate>; expiresAt: number } | null = null;

export async function getPricingTable(): Promise<Record<string, ModelRate>> {
  if (pricingCache && Date.now() < pricingCache.expiresAt) return pricingCache.value;

  const db = adminDb;
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
  const rate = table[model] ?? OPENROUTER_FALLBACK_RATES[model];
  if (!rate) throw new Error(`model_not_priced:${model}`);
  return (inputTokens / 1_000_000) * rate.inputPer1M + (outputTokens / 1_000_000) * rate.outputPer1M;
}

export function invalidatePricingCache(): void {
  pricingCache = null;
}

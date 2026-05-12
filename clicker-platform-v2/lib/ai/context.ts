import { getFirestore } from 'firebase-admin/firestore';
import type { TenantContext, ContextEnrichment } from './types';

const TTL_MS = 5 * 60 * 1000;
const contextCache = new Map<string, { value: TenantContext; expiresAt: number }>();

const DEFAULT_CONTEXT: TenantContext = {
  businessName: '',
  businessType: '',
  tone: 'professional',
  language: 'id',
  knowledgeBase: '',
  activeModules: [],
};

async function fetchTenantContext(siteId: string): Promise<TenantContext> {
  const cached = contextCache.get(siteId);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  try {
    const db = getFirestore();
    const doc = await db.doc(`sites/${siteId}/ai/context`).get();
    if (doc.exists) {
      const value = { ...DEFAULT_CONTEXT, ...(doc.data() as Partial<TenantContext>) };
      contextCache.set(siteId, { value, expiresAt: Date.now() + TTL_MS });
      return value;
    }
  } catch {
    // Fall through to defaults
  }

  return { ...DEFAULT_CONTEXT };
}

export async function buildTenantContext(
  siteId: string,
  enrichment?: ContextEnrichment
): Promise<{ systemPrompt: string; context: TenantContext }> {
  const context = await fetchTenantContext(siteId);

  const parts: string[] = [];

  if (context.businessName) parts.push(`Business: ${context.businessName}`);
  if (context.businessType) parts.push(`Type: ${context.businessType}`);
  if (context.tone) parts.push(`Tone: ${context.tone}`);
  if (context.language) {
    parts.push(`Language: ${context.language === 'id' ? 'Bahasa Indonesia' : 'English'}`);
  }
  if (context.knowledgeBase) parts.push(`\nKNOWLEDGE BASE:\n${context.knowledgeBase}`);
  if (enrichment?.products?.length) {
    const productList = enrichment.products
      .map(p => `- ${p.name}${p.price ? ` (${p.price})` : ''}${p.description ? `: ${p.description}` : ''}`)
      .join('\n');
    parts.push(`\nPRODUCTS:\n${productList}`);
  }
  if (enrichment?.custom) parts.push(`\nCONTEXT:\n${enrichment.custom}`);

  return { systemPrompt: parts.join('\n'), context };
}

export function invalidateTenantContext(siteId: string): void {
  contextCache.delete(siteId);
}

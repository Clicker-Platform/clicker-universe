# AI Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lib/ai/` as the unified AI core layer using OpenRouter, migrate AI Sales Agent, Stocklens, and Knowledge Sync off Gemini SDK.

**Architecture:** `lib/ai/client.ts` calls OpenRouter REST API using key from `lib/secrets/`. `lib/ai/models.ts` resolves model names from Firestore config. `lib/ai/credits.ts` is the existing credit system (moved clean). `lib/ai/index.ts` exposes `invokeAI`, `invokeVision`, `invokeWithTools`. All three modules remove direct Gemini SDK usage and call through `lib/ai/index.ts`.

**Tech Stack:** OpenRouter REST API, `lib/secrets/` (from Plan 1), Firebase Admin Firestore, `@google-cloud/secret-manager` (via Plan 1), TypeScript

**Prerequisite:** Plan 1 (lib/secrets/) must be complete — `getSecret('OPENROUTER_API_KEY')` must work.

---

### Task 1: Build lib/ai/types.ts

**Files:**
- Modify: `clicker-platform-v2/lib/ai/types.ts`

- [ ] **Step 1: Replace types.ts with extended version**

```typescript
// Platform-level AI types — shared across all AI modules

export interface AIRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  max_tokens?: number;
  temperature?: number;
}

export interface VisionRequest {
  model: string;
  messages: {
    role: 'user';
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;
  }[];
  max_tokens?: number;
  temperature?: number;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

export interface ToolRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }[];
  tools: ToolDefinition[];
  tool_choice?: 'auto' | 'none';
  max_tokens?: number;
  temperature?: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface AICallOptions {
  siteId: string;
  moduleId: string;
  skillId: string;
  creditCost: number;
  uid: string;
}

export interface CreditBalance {
  balance: number;
  lifetimeUsed: number;
}

export interface CreditLedgerEntry {
  type: 'topup' | 'debit' | 'refund';
  amount: number;
  balanceAfter: number;
  moduleId: string;
  skillId: string;
  description?: string;
  performedBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  metadata?: Record<string, unknown>;
}

export interface ModelConfig {
  chat: string;
  vision: string;
  tools: string;
  fast: string;
  quality: string;
}

export interface TenantContext {
  businessName: string;
  businessType: string;
  tone: string;
  language: string;
  knowledgeBase: string;
  activeModules: string[];
}

export interface ContextEnrichment {
  products?: { name: string; price?: number; description?: string }[];
  custom?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/types.ts
git commit -m "feat(ai-core): extend AI types for core layer"
```

---

### Task 2: Build lib/ai/models.ts

**Files:**
- Create: `clicker-platform-v2/lib/ai/models.ts`

- [ ] **Step 1: Create lib/ai/models.ts**

```typescript
import { getFirestore } from 'firebase-admin/firestore';
import { ModelConfig } from './types';

const MODELS_DOC = 'modules/ai-platform/config/models';
const TTL_MS = 5 * 60 * 1000; // 5 minutes

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/models.ts
git commit -m "feat(ai-core): add model registry with Firestore config + cache"
```

---

### Task 3: Build lib/ai/client.ts (replace openrouter-client.ts)

**Files:**
- Create: `clicker-platform-v2/lib/ai/client.ts`

- [ ] **Step 1: Create lib/ai/client.ts**

```typescript
import { getSecret } from '@/lib/secrets';
import { AIRequest, VisionRequest, ToolRequest, ToolResponse } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(body: Record<string, unknown>): Promise<Response> {
  const apiKey = await getSecret('OPENROUTER_API_KEY');
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://clicker.id',
      'X-Title': 'Clicker Platform',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errorBody}`);
  }
  return res;
}

export async function callText(request: AIRequest): Promise<string> {
  const res = await callOpenRouter({
    model: request.model,
    messages: request.messages,
    max_tokens: request.max_tokens ?? 2048,
    temperature: request.temperature ?? 0.7,
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty response');
  return typeof content === 'string' ? content : JSON.stringify(content);
}

export async function callVision(request: VisionRequest): Promise<string> {
  const res = await callOpenRouter({
    model: request.model,
    messages: request.messages,
    max_tokens: request.max_tokens ?? 2048,
    temperature: request.temperature ?? 0.2,
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty vision response');
  return typeof content === 'string' ? content : JSON.stringify(content);
}

export async function callWithTools(request: ToolRequest): Promise<ToolResponse> {
  const res = await callOpenRouter({
    model: request.model,
    messages: request.messages,
    tools: request.tools,
    tool_choice: request.tool_choice ?? 'auto',
    max_tokens: request.max_tokens ?? 1024,
    temperature: request.temperature ?? 0.7,
  });

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error('OpenRouter returned empty tools response');

  return {
    content: choice.message?.content ?? null,
    toolCalls: choice.message?.tool_calls ?? [],
    finishReason: choice.finish_reason ?? 'stop',
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/client.ts
git commit -m "feat(ai-core): add OpenRouter client using lib/secrets"
```

---

### Task 4: Build lib/ai/credits.ts

**Files:**
- Create: `clicker-platform-v2/lib/ai/credits.ts`

- [ ] **Step 1: Move existing credits logic**

Copy the full content from existing `lib/ai/openrouter-client.ts` credit functions — `deductCredits` and `refundCredits` — into `lib/ai/credits.ts`. The existing `lib/ai/credits.ts` already has this code from a previous refactor. Verify it exports:

```typescript
export async function deductCredits(siteId, creditCost, meta): Promise<{ balanceAfter: number }>
export async function refundCredits(siteId, creditCost, meta): Promise<void>
```

If `lib/ai/credits.ts` already exists with these exports, skip to Step 2.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/credits.ts
git commit -m "feat(ai-core): verify credits.ts exports"
```

---

### Task 5: Build lib/ai/context.ts

**Files:**
- Create: `clicker-platform-v2/lib/ai/context.ts`

- [ ] **Step 1: Create lib/ai/context.ts**

```typescript
import { getFirestore } from 'firebase-admin/firestore';
import { TenantContext, ContextEnrichment } from './types';

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

  if (context.businessName) {
    parts.push(`Business: ${context.businessName}`);
  }
  if (context.businessType) {
    parts.push(`Type: ${context.businessType}`);
  }
  if (context.tone) {
    parts.push(`Tone: ${context.tone}`);
  }
  if (context.language) {
    parts.push(`Language: ${context.language === 'id' ? 'Bahasa Indonesia' : 'English'}`);
  }
  if (context.knowledgeBase) {
    parts.push(`\nKNOWLEDGE BASE:\n${context.knowledgeBase}`);
  }
  if (enrichment?.products?.length) {
    const productList = enrichment.products
      .map(p => `- ${p.name}${p.price ? ` (${p.price})` : ''}${p.description ? `: ${p.description}` : ''}`)
      .join('\n');
    parts.push(`\nPRODUCTS:\n${productList}`);
  }
  if (enrichment?.custom) {
    parts.push(`\nCONTEXT:\n${enrichment.custom}`);
  }

  return {
    systemPrompt: parts.join('\n'),
    context,
  };
}

export function invalidateTenantContext(siteId: string): void {
  contextCache.delete(siteId);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/context.ts
git commit -m "feat(ai-core): add tenant context builder"
```

---

### Task 6: Build lib/ai/index.ts (public API)

**Files:**
- Create: `clicker-platform-v2/lib/ai/index.ts`

- [ ] **Step 1: Create lib/ai/index.ts**

```typescript
import { callText, callVision, callWithTools } from './client';
import { deductCredits, refundCredits } from './credits';
import { getModel } from './models';
import { AIRequest, VisionRequest, ToolRequest, ToolResponse, AICallOptions } from './types';

export { buildTenantContext, invalidateTenantContext } from './context';
export { getModel, getModelConfig, invalidateModelCache } from './models';
export type { AIRequest, VisionRequest, ToolRequest, ToolResponse, AICallOptions, ModelConfig, TenantContext, ContextEnrichment } from './types';

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/index.ts
git commit -m "feat(ai-core): add public AI core API (invokeAI, invokeVision, invokeWithTools)"
```

---

### Task 7: Migrate AI Sales Agent

**Files:**
- Modify: `clicker-platform-v2/lib/modules/ai-sales-agent/server/gemini-client.ts` → delete
- Modify: `clicker-platform-v2/app/api/ai-sales-agent/chat/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/knowledge/verify/route.ts`

- [ ] **Step 1: Rewrite app/api/ai-sales-agent/chat/route.ts**

Full replacement (removes all Gemini SDK calls, rewrites with invokeWithTools):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { invokeWithTools, getModel, ToolDefinition } from '@/lib/ai';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'save_lead',
      description: 'Save potential customer contact information (lead) to the database.',
      parameters: {
        type: 'object',
        properties: {
          name:  { type: 'string', description: "Customer's name" },
          email: { type: 'string', description: "Customer's email address" },
          phone: { type: 'string', description: "Customer's phone number" },
          note:  { type: 'string', description: "Summary of customer's needs or inquiry" },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_knowledge',
      description: 'Find detailed company information, promotions, or specifications from the knowledge base.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The specific topic or question to look up' },
        },
        required: ['query'],
      },
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const siteId = req.headers.get('x-site-id');
    if (!siteId) return NextResponse.json({ error: 'Site ID missing.' }, { status: 400 });

    const moduleDoc = await adminDb.doc(`sites/${siteId}/modules/ai-sales-agent`).get();
    if (!moduleDoc.exists || !moduleDoc.data()?.enabled) {
      return NextResponse.json({ error: 'AI Sales Agent module is disabled.' }, { status: 403 });
    }

    const config = moduleDoc.data() as Record<string, unknown>;
    const body = await req.json();
    const { history, newMessage } = body as { history: { role: string; text: string }[]; newMessage: string };

    if (!newMessage) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const masterPrompt = (config.systemPrompt as string) || 'You are a helpful sales assistant.';
    const businessContext = (config.businessContext as string) || '';

    let productContext = '';
    try {
      const productsSnap = await adminDb.collection('sites').doc(siteId).collection('products').get();
      const products = productsSnap.docs
        .map(doc => {
          const d = doc.data();
          return { name: d.name || d.title || 'Untitled', price: d.price, description: d.description, isActive: d.isActive !== false };
        })
        .filter(p => p.isActive);
      if (products.length > 0) {
        productContext = 'AVAILABLE PRODUCTS:\n' + products.map(p => `- ${p.name} (${p.price}): ${p.description || ''}`).join('\n');
      }
    } catch { /* continue without products */ }

    let kbContent = '';
    try {
      const kbDoc = await adminDb.doc(`sites/${siteId}/modules/ai-sales-agent`).get();
      kbContent = (kbDoc.data()?.knowledgeBaseContent as string) || '';
    } catch { /* continue without KB */ }

    const systemPrompt = `${masterPrompt}\n\nBUSINESS CONTEXT:\n${businessContext}\n\n${productContext}\n\nINSTRUCTIONS:\n- Be polite, professional, and helpful.\n- Base answers strictly on the Business Context and Available Products provided.\n- LANGUAGE RULE: Always answer in the SAME language as the user.\n- Keep responses concise (under 3 sentences) unless detailed info is requested.`;

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'model' ? ('assistant' as const) : ('user' as const),
        content: msg.text,
      })),
      { role: 'user', content: newMessage },
    ];

    const model = await getModel('tools');
    const result = await invokeWithTools(
      { model, messages, tools: TOOLS, max_tokens: 500, temperature: 0.7 },
      { siteId, moduleId: 'ai_sales_agent', skillId: 'chat', creditCost: 1, uid: 'public' }
    );

    // Handle tool calls
    if (result.finishReason === 'tool_calls' && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls[0];
      let toolResult = '';

      if (toolCall.function.name === 'save_lead') {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, string>;
        await adminDb.collection(`sites/${siteId}/leads`).add({
          ...args,
          source: 'ai_chat',
          capturedAt: Date.now(),
        });
        toolResult = 'Lead saved successfully.';
      } else if (toolCall.function.name === 'lookup_knowledge') {
        toolResult = kbContent || 'No knowledge base content available.';
      }

      // Follow-up call with tool result
      const followUpMessages = [
        ...messages,
        { role: 'assistant' as const, content: result.content ?? '', tool_calls: result.toolCalls },
        { role: 'tool' as const, content: toolResult, tool_call_id: toolCall.id, name: toolCall.function.name },
      ];

      const followUp = await invokeWithTools(
        { model, messages: followUpMessages as never, tools: TOOLS, max_tokens: 500, temperature: 0.7 },
        { siteId, moduleId: 'ai_sales_agent', skillId: 'chat_followup', creditCost: 1, uid: 'public' }
      );

      return NextResponse.json({ response: followUp.content ?? '', timestamp: Date.now() });
    }

    return NextResponse.json({ response: result.content ?? '', timestamp: Date.now() });
  } catch (error: unknown) {
    const siteId = req.headers.get('x-site-id') ?? 'platform';
    logger.error('ai.chat.failed', { siteId, error });
    return NextResponse.json({ error: 'Failed to generate response.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Fix app/api/admin/knowledge/verify/route.ts**

Remove `listAvailableModels` usage. Replace the AI engine check with a simple OpenRouter ping:

```typescript
// Remove import of listAvailableModels
// Replace aiEngine layer check with:
try {
  const { getSecret } = await import('@/lib/secrets');
  const key = await getSecret('OPENROUTER_API_KEY');
  diagnostic.layers.aiEngine = {
    status: key ? 'OK' : 'ERROR',
    message: key ? 'OpenRouter API key configured.' : 'OpenRouter API key missing.',
  };
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : 'Unknown';
  diagnostic.layers.aiEngine = { status: 'ERROR', message: 'Cannot access OpenRouter key: ' + msg };
}
```

- [ ] **Step 3: Delete gemini-client.ts**

```bash
rm lib/modules/ai-sales-agent/server/gemini-client.ts
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors. Fix any remaining import of `gemini-client`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ai-core): migrate AI Sales Agent from Gemini SDK to invokeWithTools"
```

---

### Task 8: Migrate Stocklens

**Files:**
- Modify: `clicker-platform-v2/lib/modules/stocklens/server/gemini-scanner.ts` → delete
- Modify: `clicker-platform-v2/app/api/stocklens/scan/route.ts`
- Modify: `clicker-platform-v2/app/api/stocklens/test-key/route.ts`

- [ ] **Step 1: Create new scanner using invokeVision**

Create `lib/modules/stocklens/server/scanner.ts`:

```typescript
import { invokeVision, getModel } from '@/lib/ai';
import { ScanResult, ItemCondition, CategoryCode } from '../types';
import { CATEGORY_CODES } from '../constants';
import { logger } from '@/lib/logger';

const SCAN_PROMPT = `You are a product identification and pricing expert. Analyze this product image.

Return ONLY a valid JSON object with these exact fields (no markdown, no extra text):
{
  "name": "Full product name including series/variant",
  "brand": "Brand or manufacturer name",
  "category": "One of: ELC, TOY, SHO, CLO, GAM, SPT, HOM, BOO, ACC, GEN",
  "sku": "Suggested SKU in format CAT-BRAND3-MODEL (e.g. TOY-HSB-BHEAD)",
  "series": "Product series if applicable, otherwise omit",
  "releasePrice": 0,
  "marketPrice": 0,
  "suggestedCondition": "One of: BNIB, BNOB, SECOND, BROKEN based on visual",
  "aiAnalysis": "Short product description in Bahasa Indonesia, 1-2 sentences"
}

Pricing rules (CRITICAL — never return 0):
- releasePrice = official retail price in IDR when this product first launched
- marketPrice = current estimated retail price in IDR for brand new stock
- If price is in USD, convert to IDR (1 USD ≈ 16000 IDR)
- Both must be realistic non-zero integers

Other rules:
- category must be exactly one of the listed codes
- suggestedCondition: BNIB if sealed/new, BNOB if box opened unused, SECOND if visibly used, BROKEN if damaged
- sku brand code: first 3 uppercase letters of brand (Apple→APL, Nike→NKE, Hasbro→HSB, Sony→SNY)
- If product cannot be identified, make your best guess — never leave prices as 0`;

export async function scanProductImage(
  siteId: string,
  imageBase64: string,
  mimeType: string
): Promise<ScanResult> {
  const model = await getModel('vision');

  const raw = await invokeVision(
    {
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: SCAN_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 512,
      temperature: 0.1,
    },
    { siteId, moduleId: 'stocklens', skillId: 'scan_product', creditCost: 3, uid: 'system' }
  );

  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    logger.error('stocklens.scan.parse.failed', { siteId, raw });
    return { name: '', brand: '', category: 'GEN', sku: '', releasePrice: 0, marketPrice: 0, suggestedCondition: 'SECOND', aiAnalysis: 'Produk tidak dapat diidentifikasi. Silakan isi manual.' };
  }

  const rawCategory = parsed.category as string;
  const category: CategoryCode = (CATEGORY_CODES as readonly string[]).includes(rawCategory) ? (rawCategory as CategoryCode) : 'GEN';

  const conditions: ItemCondition[] = ['BNIB', 'BNOB', 'SECOND', 'BROKEN'];
  const rawCondition = parsed.suggestedCondition as string;
  const suggestedCondition: ItemCondition = (conditions as string[]).includes(rawCondition) ? (rawCondition as ItemCondition) : 'SECOND';

  return {
    name: (parsed.name as string) || '',
    brand: (parsed.brand as string) || '',
    category,
    sku: (parsed.sku as string) || '',
    series: parsed.series as string | undefined,
    releasePrice: Number(parsed.releasePrice) || 0,
    marketPrice: Number(parsed.marketPrice) || 0,
    suggestedCondition,
    aiAnalysis: (parsed.aiAnalysis as string) || '',
  };
}
```

- [ ] **Step 2: Update app/api/stocklens/scan/route.ts**

Replace import:
```typescript
// Remove: import { scanProductImage } from '@/lib/modules/stocklens/server/gemini-scanner';
import { scanProductImage } from '@/lib/modules/stocklens/server/scanner';
```

Also update the error handling — remove quota-specific Gemini error message:
```typescript
// Replace:
const isQuotaError = message.includes('429') || message.includes('quota') || message.includes('Too Many Requests');
if (isQuotaError) {
  return NextResponse.json({ error: 'Quota Gemini API habis...' }, { status: 429 });
}
// With:
return NextResponse.json({ error: message }, { status: 500 });
```

- [ ] **Step 3: Rewrite app/api/stocklens/test-key/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { secretExists } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { siteId } = await req.json() as { siteId?: string };
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const exists = await secretExists('OPENROUTER_API_KEY');
    if (!exists) return NextResponse.json({ error: 'OpenRouter API Key belum dikonfigurasi.' }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Delete gemini-scanner.ts**

```bash
rm lib/modules/stocklens/server/gemini-scanner.ts
```

- [ ] **Step 5: Remove per-site API key UI from Stocklens settings**

In `lib/modules/stocklens/admin/SettingsPage.tsx`, find and remove the API key input field and save logic. Replace with a note: `"AI powered by Clicker Platform (OpenRouter)"`.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ai-core): migrate Stocklens from Gemini SDK to invokeVision"
```

---

### Task 9: Migrate Knowledge Sync (PDF extraction)

**Files:**
- Modify: `clicker-platform-v2/app/api/admin/knowledge/sync/route.ts`

- [ ] **Step 1: Replace inline Gemini call with invokeVision**

In `app/api/admin/knowledge/sync/route.ts`, find the PDF processing block:

```typescript
// Remove:
const { getGeminiClient } = await import("@/lib/modules/ai-sales-agent/server/gemini-client");
const ai = await getGeminiClient(siteId);
const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
...
const result = await model.generateContent([prompt, { inlineData: { data: base64Pdf, mimeType: "application/pdf" } }]);
const response = await result.response;
const text = response.text();
```

Replace with:

```typescript
import { invokeVision, getModel } from '@/lib/ai';

// Inside PDF block:
const visionModel = await getModel('vision');
const text = await invokeVision(
  {
    model: visionModel,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}` } },
      ],
    }],
    max_tokens: 4096,
    temperature: 0.1,
  },
  { siteId, moduleId: 'ai_sales_agent', skillId: 'pdf_extraction', creditCost: 5, uid: 'system' }
);
```

- [ ] **Step 2: Remove per-site Gemini API key from AI Sales Agent admin config**

In `lib/modules/ai-sales-agent/admin/AgentSettingsPage.tsx`, remove the API key input field and any save/load logic for `apiKey`. Platform key is used automatically.

In `app/api/admin/modules/ai-sales-agent/config/route.ts`, remove `apiKey` from the saved fields.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ai-core): migrate Knowledge Sync PDF extraction to invokeVision"
```

---

### Task 10: Remove @google/generative-ai package

**Files:**
- Modify: `clicker-platform-v2/package.json`

- [ ] **Step 1: Verify 0 remaining imports**

```bash
grep -rn "@google/generative-ai" --include="*.ts" --include="*.tsx" lib/ app/
```

Expected: 0 results. If any remain, fix them before continuing.

- [ ] **Step 2: Remove package**

```bash
pnpm remove @google/generative-ai
```

- [ ] **Step 3: Final build check**

```bash
pnpm tsc --noEmit
pnpm build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(ai-core): remove @google/generative-ai package — migration complete"
```

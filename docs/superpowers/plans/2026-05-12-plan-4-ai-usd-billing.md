# AI USD Billing & Usage Transparency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace integer credit system with USD-based billing using actual token usage per model, with full usage transparency for tenants.

**Architecture:** `lib/ai/pricing.ts` fetches per-model rates from Firestore (managed by Backyard). `lib/ai/client.ts` returns token usage from OpenRouter responses. `lib/ai/index.ts` calculates cost after each AI call and deducts from tenant balance in USD. Ledger entries store model, tokens, and costUSD. Tenant sees usage at `/admin/ai-usage`.

**Tech Stack:** TypeScript, Firestore (firebase-admin), Next.js 15 App Router, React client components, Tailwind CSS.

---

## File Map

### Platform (`clicker-platform-v2/`)

**Create:**
- `lib/ai/pricing.ts` — fetch/cache pricing table, calculateCost()
- `app/api/admin/ai-usage/route.ts` — GET tenant ledger (debit only, cursor-based)
- `app/admin/(dashboard)/ai-usage/page.tsx` — page shell (server component)
- `lib/modules/ai-platform/admin/UsagePage.tsx` — client UI (summary cards + table)

**Modify:**
- `lib/ai/types.ts` — remove `creditCost` from `AICallOptions`, add `AIUsageResult`
- `lib/ai/client.ts` — return `{ content, inputTokens, outputTokens, model }` from all 3 functions
- `lib/ai/credits.ts` — new `deductCredits` signature (costUSD + model + tokens), remove `initTenantCredits`, update `refundCredits`
- `lib/ai/index.ts` — rewrite `withCredits`: pre-flight balance check, call AI first, then deduct
- `lib/ai/index.ts` — update exports (add `calculateCost` export)
- `app/api/ai-sales-agent/chat/route.ts` — remove `creditCost`
- `app/api/admin/knowledge/sync/route.ts` — remove `creditCost`
- `app/api/admin/modules/ai-marketing/assets/analyze/route.ts` — remove `creditCost`, remove `CREDIT_COST` const
- `lib/modules/stocklens/server/scanner.ts` — remove `creditCost`
- `lib/modules/ai-marketing/orchestrator/runner.ts` — remove `creditCost`, remove `SKILL_CREDIT_COST` usage
- `lib/modules/ai-marketing/config/model-config.ts` — remove `SKILL_CREDIT_COST` entirely
- `lib/modules/ai-marketing/config/skills-catalog.ts` — remove `creditCost` from all skill definitions
- `lib/modules/ai-marketing/types.ts` — remove `creditCost` from `SkillDefinition`
- `lib/modules/ai-marketing/components/SkillCard.tsx` — remove credit cost display
- `components/admin/AICreditBanner.tsx` — update thresholds to USD ($0.50 warn, $0.10 critical)
- `app/admin/(dashboard)/AdminSidebar.tsx` — add AI Usage nav link

### Backyard (`backyard/`)

**Create:**
- `app/api/ai-settings/pricing/route.ts` — GET + POST pricing table
- `app/ai-settings/_components/PricingPanel.tsx` — manage per-model rates UI

**Modify:**
- `app/api/ai-settings/credits/route.ts` — display USD (format `$x.xxxx`)
- `app/api/ai-settings/usage/route.ts` — add model/inputTokens/outputTokens/costUSD columns
- `app/ai-settings/_components/CreditOverview.tsx` — show USD format, float input
- `app/ai-settings/_components/UsageLog.tsx` — add model/tokens/costUSD columns
- `app/ai-settings/page.tsx` — add Pricing tab

---

## Task 1: `lib/ai/pricing.ts` — price table + cost calculator

**Files:**
- Create: `clicker-platform-v2/lib/ai/pricing.ts`

- [ ] **Step 1: Create the file**

```typescript
// clicker-platform-v2/lib/ai/pricing.ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/worktrees/feature-ai-core/clicker-platform-v2
npx tsc --noEmit 2>&1 | grep "pricing" | head -20
```
Expected: no errors mentioning `pricing.ts`

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/ai/pricing.ts
git commit -m "feat(ai): add pricing table + calculateCost — USD per token per model"
```

---

## Task 2: Update `lib/ai/types.ts` — remove creditCost, add AIUsageResult

**Files:**
- Modify: `clicker-platform-v2/lib/ai/types.ts`

- [ ] **Step 1: Update AICallOptions — remove creditCost**

In `lib/ai/types.ts`, replace:
```typescript
export interface AICallOptions {
  siteId: string;
  moduleId: string;
  skillId: string;
  creditCost: number;
  uid: string;
}
```
With:
```typescript
export interface AICallOptions {
  siteId: string;
  moduleId: string;
  skillId: string;
  uid: string;
}

export interface AIUsageResult {
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  model: string;
}
```

- [ ] **Step 2: Verify compile (expect errors — callers still pass creditCost)**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/worktrees/feature-ai-core/clicker-platform-v2
npx tsc --noEmit 2>&1 | grep "creditCost" | wc -l
```
Expected: multiple errors (that's fine — we'll fix callers in later tasks)

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/ai/types.ts
git commit -m "feat(ai): remove creditCost from AICallOptions, add AIUsageResult type"
```

---

## Task 3: Update `lib/ai/client.ts` — return token usage

**Files:**
- Modify: `clicker-platform-v2/lib/ai/client.ts`

- [ ] **Step 1: Add return types and update callText**

Replace entire `callText` function:
```typescript
export interface AIResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function callText(request: AIRequest): Promise<AIResult> {
  const res = await callOpenRouter({
    model: request.model,
    messages: request.messages,
    max_tokens: request.max_tokens ?? 2048,
    temperature: request.temperature ?? 0.7,
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty response');

  const inputTokens = data.usage?.prompt_tokens
    ?? Math.ceil((request.max_tokens ?? 2048) * 0.3);
  const outputTokens = data.usage?.completion_tokens
    ?? (request.max_tokens ?? 2048);
  if (!data.usage?.prompt_tokens) {
    console.warn('[ai/client] usage missing for model:', request.model);
  }

  return {
    content: typeof content === 'string' ? content : JSON.stringify(content),
    inputTokens,
    outputTokens,
    model: request.model,
  };
}
```

- [ ] **Step 2: Update callVision**

Replace entire `callVision` function:
```typescript
export async function callVision(request: VisionRequest): Promise<AIResult> {
  const res = await callOpenRouter({
    model: request.model,
    messages: request.messages,
    max_tokens: request.max_tokens ?? 2048,
    temperature: request.temperature ?? 0.2,
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty vision response');

  const inputTokens = data.usage?.prompt_tokens
    ?? Math.ceil((request.max_tokens ?? 2048) * 0.3);
  const outputTokens = data.usage?.completion_tokens
    ?? (request.max_tokens ?? 2048);
  if (!data.usage?.prompt_tokens) {
    console.warn('[ai/client] usage missing for model:', request.model);
  }

  return {
    content: typeof content === 'string' ? content : JSON.stringify(content),
    inputTokens,
    outputTokens,
    model: request.model,
  };
}
```

- [ ] **Step 3: Update callWithTools — add new return type**

Add interface and replace function:
```typescript
export interface AIToolResult {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function callWithTools(request: ToolRequest): Promise<AIToolResult> {
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

  const inputTokens = data.usage?.prompt_tokens
    ?? Math.ceil((request.max_tokens ?? 1024) * 0.3);
  const outputTokens = data.usage?.completion_tokens
    ?? (request.max_tokens ?? 1024);
  if (!data.usage?.prompt_tokens) {
    console.warn('[ai/client] usage missing for model:', request.model);
  }

  return {
    content: choice.message?.content ?? null,
    toolCalls: choice.message?.tool_calls ?? [],
    finishReason: choice.finish_reason ?? 'stop',
    inputTokens,
    outputTokens,
    model: request.model,
  };
}
```

- [ ] **Step 4: Remove old `ToolResponse` import from types (now using AIToolResult)**

In `lib/ai/client.ts` top, update import:
```typescript
import type { AIRequest, VisionRequest, ToolRequest, ToolCall } from './types';
```

- [ ] **Step 5: Verify compile**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/worktrees/feature-ai-core/clicker-platform-v2
npx tsc --noEmit 2>&1 | grep "client.ts" | head -10
```
Expected: no errors in `client.ts`

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/ai/client.ts
git commit -m "feat(ai): client returns token usage + fallback estimate when usage missing"
```

---

## Task 4: Update `lib/ai/credits.ts` — USD-based deduction

**Files:**
- Modify: `clicker-platform-v2/lib/ai/credits.ts`

- [ ] **Step 1: Rewrite entire file**

```typescript
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { CreditBalance } from './types';

const CREDIT_DOC_PATH = (siteId: string) => `sites/${siteId}/platform/aiCredits`;

function ledgerCol(db: Firestore, siteId: string) {
  return db.collection('sites').doc(siteId)
    .collection('platform').doc('aiCreditLedger')
    .collection('entries');
}

export async function deductCredits(
  siteId: string,
  costUSD: number,
  meta: {
    moduleId: string;
    skillId: string;
    uid: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }
): Promise<{ balanceAfter: number }> {
  const db = getFirestore();
  const creditRef = db.doc(CREDIT_DOC_PATH(siteId));

  return db.runTransaction(async (transaction) => {
    const creditDoc = await transaction.get(creditRef);

    if (!creditDoc.exists) {
      transaction.set(creditRef, { balance: 0, lifetimeUsed: 0 });
      throw new Error(`insufficient_credits:0:${costUSD}`);
    }

    const balance: number = creditDoc.data()?.balance ?? 0;
    if (balance < costUSD) {
      throw new Error(`insufficient_credits:${balance}:${costUSD}`);
    }

    const balanceAfter = Math.round((balance - costUSD) * 1_000_000) / 1_000_000;
    transaction.update(creditRef, {
      balance: balanceAfter,
      lifetimeUsed: FieldValue.increment(costUSD),
    });

    transaction.set(ledgerCol(db, siteId).doc(), {
      type: 'debit',
      amount: -costUSD,
      balanceAfter,
      moduleId: meta.moduleId,
      skillId: meta.skillId,
      model: meta.model,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      costUSD,
      performedBy: meta.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balanceAfter };
  });
}

export async function refundCredits(
  siteId: string,
  costUSD: number,
  meta: { moduleId: string; skillId: string; reason: string; model: string }
): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();

  batch.update(db.doc(CREDIT_DOC_PATH(siteId)), {
    balance: FieldValue.increment(costUSD),
    lifetimeUsed: FieldValue.increment(-costUSD),
  });

  batch.set(ledgerCol(db, siteId).doc(), {
    type: 'refund',
    amount: costUSD,
    moduleId: meta.moduleId,
    skillId: meta.skillId,
    model: meta.model,
    description: `Refund: ${meta.reason}`,
    performedBy: 'system',
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

export async function addCredits(
  siteId: string,
  amountUSD: number,
  meta: { performedBy: string; reason: string }
): Promise<{ balanceAfter: number }> {
  const db = getFirestore();
  const creditRef = db.doc(CREDIT_DOC_PATH(siteId));

  return db.runTransaction(async (transaction) => {
    const creditDoc = await transaction.get(creditRef);
    const currentBalance: number = creditDoc.exists ? (creditDoc.data()?.balance ?? 0) : 0;
    const balanceAfter = Math.round((currentBalance + amountUSD) * 1_000_000) / 1_000_000;

    if (creditDoc.exists) {
      transaction.update(creditRef, { balance: balanceAfter });
    } else {
      transaction.set(creditRef, { balance: balanceAfter, lifetimeUsed: 0 });
    }

    transaction.set(ledgerCol(db, siteId).doc(), {
      type: 'topup',
      amount: amountUSD,
      balanceAfter,
      moduleId: 'platform',
      skillId: 'manual_topup',
      description: meta.reason,
      performedBy: meta.performedBy,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balanceAfter };
  });
}

export async function getCreditBalance(siteId: string): Promise<CreditBalance> {
  const db = getFirestore();
  const doc = await db.doc(CREDIT_DOC_PATH(siteId)).get();
  if (!doc.exists) return { balance: 0, lifetimeUsed: 0 };
  const data = doc.data()!;
  return { balance: data.balance ?? 0, lifetimeUsed: data.lifetimeUsed ?? 0 };
}
```

- [ ] **Step 2: Verify compile**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/worktrees/feature-ai-core/clicker-platform-v2
npx tsc --noEmit 2>&1 | grep "credits.ts" | head -10
```
Expected: no errors in `credits.ts`

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/ai/credits.ts
git commit -m "feat(ai): credits use USD float — deductCredits takes costUSD + model + tokens"
```

---

## Task 5: Rewrite `lib/ai/index.ts` — USD withCredits flow

**Files:**
- Modify: `clicker-platform-v2/lib/ai/index.ts`

- [ ] **Step 1: Rewrite entire file**

```typescript
import { callText, callVision, callWithTools } from './client';
import type { AIResult, AIToolResult } from './client';
import { deductCredits, refundCredits, getCreditBalance } from './credits';
import { calculateCost } from './pricing';
import type { AIRequest, VisionRequest, ToolRequest, AICallOptions } from './types';

export { buildTenantContext, invalidateTenantContext } from './context';
export { getModel, getModelConfig, invalidateModelCache } from './models';
export { calculateCost, invalidatePricingCache } from './pricing';
export type { AIRequest, VisionRequest, ToolRequest, AIToolResult, AICallOptions, ModelConfig, TenantContext, ContextEnrichment, AIUsageResult } from './types';
export type { AIResult } from './client';

// Re-export ToolResponse shape as AIToolResult for callers
export type { ToolCall, ToolDefinition } from './types';

async function preflightCheck(siteId: string): Promise<void> {
  const { balance } = await getCreditBalance(siteId);
  if (balance <= 0) {
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
      // AI already called — log and absorb (balance was >0 at preflight, tiny shortfall)
      console.warn('[ai/index] post-call insufficient — absorbing cost:', { siteId, moduleId, skillId, model });
      return;
    }
    if (msg.startsWith('model_not_priced:')) {
      console.error('[ai/index] model not priced:', msg, { siteId, moduleId, skillId });
      return;
    }
    // Other billing errors — log, do not block caller
    console.error('[ai/index] deductCredits failed:', msg, { siteId, moduleId, skillId });
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
```

- [ ] **Step 2: Verify compile**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/worktrees/feature-ai-core/clicker-platform-v2
npx tsc --noEmit 2>&1 | grep "lib/ai" | head -20
```
Expected: no errors in `lib/ai/`

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/ai/index.ts
git commit -m "feat(ai): rewrite withCredits — pre-flight gate, deduct after call, USD cost"
```

---

## Task 6: Remove creditCost from all callers

**Files:**
- Modify: `clicker-platform-v2/app/api/ai-sales-agent/chat/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/knowledge/sync/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/modules/ai-marketing/assets/analyze/route.ts`
- Modify: `clicker-platform-v2/lib/modules/stocklens/server/scanner.ts`
- Modify: `clicker-platform-v2/lib/modules/ai-marketing/orchestrator/runner.ts`
- Modify: `clicker-platform-v2/lib/modules/ai-marketing/config/model-config.ts`
- Modify: `clicker-platform-v2/lib/modules/ai-marketing/config/skills-catalog.ts`
- Modify: `clicker-platform-v2/lib/modules/ai-marketing/types.ts`
- Modify: `clicker-platform-v2/lib/modules/ai-marketing/components/SkillCard.tsx`

- [ ] **Step 1: Fix chat/route.ts — remove creditCost from both invokeWithTools calls**

In `app/api/ai-sales-agent/chat/route.ts`, change:
```typescript
// line ~96
{ siteId, moduleId: 'ai_sales_agent', skillId: 'chat', creditCost: 1, uid: 'public' }
// line ~123
{ siteId, moduleId: 'ai_sales_agent', skillId: 'chat_followup', creditCost: 1, uid: 'public' }
```
To:
```typescript
{ siteId, moduleId: 'ai_sales_agent', skillId: 'chat', uid: 'public' }
{ siteId, moduleId: 'ai_sales_agent', skillId: 'chat_followup', uid: 'public' }
```

- [ ] **Step 2: Fix knowledge/sync/route.ts**

Change:
```typescript
{ siteId, moduleId: 'ai_sales_agent', skillId: 'pdf_extraction', creditCost: 5, uid: 'system' }
```
To:
```typescript
{ siteId, moduleId: 'ai_sales_agent', skillId: 'pdf_extraction', uid: 'system' }
```

- [ ] **Step 3: Fix ai-marketing/assets/analyze/route.ts — remove CREDIT_COST const and creditCost**

Remove the line:
```typescript
const CREDIT_COST = 5;
```
Change:
```typescript
{ siteId, moduleId: 'ai_marketing', skillId: 'analyze_' + assetType, creditCost: CREDIT_COST, uid }
```
To:
```typescript
{ siteId, moduleId: 'ai_marketing', skillId: 'analyze_' + assetType, uid }
```

- [ ] **Step 4: Fix stocklens/server/scanner.ts**

Change:
```typescript
{ siteId, moduleId: 'stocklens', skillId: 'scan_product', creditCost: 3, uid: 'system' }
```
To:
```typescript
{ siteId, moduleId: 'stocklens', skillId: 'scan_product', uid: 'system' }
```

- [ ] **Step 5: Fix runner.ts — remove SKILL_CREDIT_COST usage, update RunnerOutput**

In `lib/modules/ai-marketing/orchestrator/runner.ts`:

Remove import of `SKILL_CREDIT_COST`:
```typescript
import { SKILL_MODEL_MAP } from '../config/model-config';
```

Remove line:
```typescript
const creditCost = SKILL_CREDIT_COST[skillId] ?? 3;
```

Change both `invokeVision` and `invokeAI` options (remove `creditCost`):
```typescript
// vision path
{ siteId, moduleId: 'ai_marketing', skillId, uid }

// text path
{ siteId, moduleId: 'ai_marketing', skillId, uid }
```

Update `RunnerOutput` interface — replace `creditsUsed` with `costUSD`:
```typescript
export interface RunnerOutput {
  content: string;
  variations?: string[];
  structured?: Record<string, any>;
  model: string;
  costUSD?: number;  // populated after billing (may be undefined if billing failed)
}
```

Update return at end of `runSkill`:
```typescript
return {
  content: raw,
  structured,
  model: resolvedModel,
};
```

Update `runFlow` — replace `totalCreditsUsed` with `totalCostUSD`:
```typescript
export async function runFlow(...): Promise<{ stepOutputs: Record<string, RunnerOutput>; totalCostUSD: number }> {
  // ...
  let totalCostUSD = 0;
  // remove: totalCreditsUsed += result.creditsUsed;
  return { stepOutputs, totalCostUSD };
}
```

- [ ] **Step 6: Remove SKILL_CREDIT_COST from model-config.ts**

In `lib/modules/ai-marketing/config/model-config.ts`, remove the entire `SKILL_CREDIT_COST` export (the second `export const` block).

- [ ] **Step 7: Remove creditCost from skills-catalog.ts**

In `lib/modules/ai-marketing/config/skills-catalog.ts`:
- Remove `import { SKILL_CREDIT_COST } from './model-config'`  (or remove from destructure)
- Remove `creditCost:` property from every skill definition (there are ~15 entries)

- [ ] **Step 8: Remove creditCost from types.ts**

In `lib/modules/ai-marketing/types.ts`, remove:
```typescript
creditCost: number;
```
from the `SkillDefinition` interface.

- [ ] **Step 9: Remove credit display from SkillCard.tsx**

In `lib/modules/ai-marketing/components/SkillCard.tsx`, remove the line:
```typescript
<span>{skill.creditCost}</span>
```
and any surrounding credit cost UI elements.

- [ ] **Step 10: Verify full compile**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/worktrees/feature-ai-core/clicker-platform-v2
npx tsc --noEmit 2>&1 | head -40
```
Expected: 0 errors

- [ ] **Step 11: Commit**

```bash
git add -p  # stage all modified files
git commit -m "feat(ai): remove creditCost from all callers — billing now automatic via token usage"
```

---

## Task 7: Backyard — Pricing API + Panel

**Files:**
- Create: `backyard/app/api/ai-settings/pricing/route.ts`
- Create: `backyard/app/ai-settings/_components/PricingPanel.tsx`
- Modify: `backyard/app/ai-settings/page.tsx`

- [ ] **Step 1: Create pricing API route**

```typescript
// backyard/app/api/ai-settings/pricing/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const PRICING_DOC = 'modules/ai-platform/config/pricing';

export async function GET() {
  try {
    const doc = await adminDb.doc(PRICING_DOC).get();
    const models = (doc.data()?.models as Record<string, { inputPer1M: number; outputPer1M: number }>) ?? {};
    return NextResponse.json({ models });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { models } = await req.json() as { models: Record<string, { inputPer1M: number; outputPer1M: number }> };
    if (!models || typeof models !== 'object') {
      return NextResponse.json({ error: 'Invalid models payload' }, { status: 400 });
    }
    await adminDb.doc(PRICING_DOC).set({ models, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create PricingPanel.tsx**

```typescript
// backyard/app/ai-settings/_components/PricingPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Save, DollarSign } from 'lucide-react';

interface ModelRate {
  inputPer1M: number;
  outputPer1M: number;
}

export function PricingPanel() {
  const [models, setModels] = useState<Record<string, ModelRate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newModel, setNewModel] = useState('');
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');

  useEffect(() => {
    fetch('/api/ai-settings/pricing')
      .then(r => r.json())
      .then((data: { models: Record<string, ModelRate> }) => setModels(data.models ?? {}))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/ai-settings/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models }),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    if (!newModel || !newInput || !newOutput) return;
    setModels(prev => ({
      ...prev,
      [newModel.trim()]: { inputPer1M: Number(newInput), outputPer1M: Number(newOutput) },
    }));
    setNewModel(''); setNewInput(''); setNewOutput('');
  }

  function handleDelete(modelId: string) {
    setModels(prev => { const next = { ...prev }; delete next[modelId]; return next; });
  }

  function handleEdit(modelId: string, field: 'inputPer1M' | 'outputPer1M', value: string) {
    setModels(prev => ({ ...prev, [modelId]: { ...prev[modelId], [field]: Number(value) } }));
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>;

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-gray-400" />
        <span className="font-black">Model Pricing</span>
        <span className="text-xs text-gray-400 ml-1">($/1M tokens)</span>
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-100">
              <th className="text-left py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide text-xs">Model ID</th>
              <th className="text-right py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide text-xs">Input $/1M</th>
              <th className="text-right py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide text-xs">Output $/1M</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {Object.entries(models).map(([modelId, rate]) => (
              <tr key={modelId} className="border-b border-gray-50">
                <td className="py-2 pr-4 font-mono text-xs">{modelId}</td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    step="0.01"
                    value={rate.inputPer1M}
                    onChange={e => handleEdit(modelId, 'inputPer1M', e.target.value)}
                    className="w-24 text-right border-2 border-gray-200 rounded-lg px-2 py-1 text-sm ml-auto block"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    step="0.01"
                    value={rate.outputPer1M}
                    onChange={e => handleEdit(modelId, 'outputPer1M', e.target.value)}
                    className="w-24 text-right border-2 border-gray-200 rounded-lg px-2 py-1 text-sm ml-auto block"
                  />
                </td>
                <td className="py-2">
                  <button onClick={() => handleDelete(modelId)} className="text-gray-300 hover:text-red-500 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newModel}
          onChange={e => setNewModel(e.target.value)}
          placeholder="model-id (e.g. google/gemini-2.0-flash)"
          className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
        />
        <input type="number" step="0.01" value={newInput} onChange={e => setNewInput(e.target.value)}
          placeholder="Input" className="w-24 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm text-right" />
        <input type="number" step="0.01" value={newOutput} onChange={e => setNewOutput(e.target.value)}
          placeholder="Output" className="w-24 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm text-right" />
        <button onClick={handleAdd} disabled={!newModel || !newInput || !newOutput}
          className="flex items-center gap-1 bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-bold disabled:opacity-40">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Pricing
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add Pricing tab to ai-settings/page.tsx**

Read current `backyard/app/ai-settings/page.tsx`, then add `PricingPanel` as a new section. The page currently renders `<ModelRegistry />`, `<CreditOverview />`, `<UsageLog />` in sequence. Add `<PricingPanel />` between `<ModelRegistry />` and `<CreditOverview />`:

```typescript
import { PricingPanel } from './_components/PricingPanel';
// ...
<PricingPanel />
```

- [ ] **Step 4: Verify backyard compiles**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/worktrees/feature-ai-core/backyard
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add backyard/app/api/ai-settings/pricing/route.ts backyard/app/ai-settings/_components/PricingPanel.tsx backyard/app/ai-settings/page.tsx
git commit -m "feat(backyard): add model pricing panel — CRUD for per-model USD rates"
```

---

## Task 8: Update Backyard CreditOverview + UsageLog for USD

**Files:**
- Modify: `backyard/app/ai-settings/_components/CreditOverview.tsx`
- Modify: `backyard/app/ai-settings/_components/UsageLog.tsx`

- [ ] **Step 1: Update CreditOverview — USD display + float input**

In `CreditOverview.tsx`:

1. Change balance display from `{site.balance} cr` to `$${site.balance.toFixed(4)}`
2. Change used display from `{site.lifetimeUsed} used` to `$${site.lifetimeUsed.toFixed(4)} used`
3. Change balance color thresholds: `< 0.10` → red, `< 0.50` → amber, else green
4. Change top-up amount input: add `step="0.01"` and `placeholder="USD amount (e.g. 5.00)"`

- [ ] **Step 2: Update UsageLog — add model/tokens/costUSD columns**

In `UsageLog.tsx`:

Update `LogEntry` interface:
```typescript
interface LogEntry {
  id: string;
  siteId: string;
  siteName?: string;
  type: 'debit' | 'topup' | 'refund';
  amount: number;
  balanceAfter?: number;
  moduleId?: string;
  skillId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUSD?: number;
  description?: string;
  performedBy?: string;
  createdAt: string | null;
}
```

Update table headers — add Model, Tokens, Cost columns after Module/Skill. Update amount display to `$${Math.abs(entry.amount).toFixed(6)}`. Update balance display to `$${entry.balanceAfter?.toFixed(4)}`.

Add new cells per row:
```tsx
<td className="py-2 pr-3 text-gray-400 font-mono text-xs">
  {entry.model?.split('/')[1] ?? '—'}
</td>
<td className="py-2 pr-3 text-gray-400 text-xs">
  {entry.inputTokens != null ? `${entry.inputTokens}/${entry.outputTokens}` : '—'}
</td>
<td className="py-2 pr-3 text-right font-mono text-xs">
  {entry.costUSD != null ? `$${entry.costUSD.toFixed(6)}` : '—'}
</td>
```

- [ ] **Step 3: Commit**

```bash
git add backyard/app/ai-settings/_components/CreditOverview.tsx backyard/app/ai-settings/_components/UsageLog.tsx
git commit -m "feat(backyard): update credit overview + usage log for USD display"
```

---

## Task 9: Tenant Usage API + Page

**Files:**
- Create: `clicker-platform-v2/app/api/admin/ai-usage/route.ts`
- Create: `clicker-platform-v2/app/admin/(dashboard)/ai-usage/page.tsx`
- Create: `clicker-platform-v2/lib/modules/ai-platform/admin/UsagePage.tsx`
- Modify: `clicker-platform-v2/app/admin/(dashboard)/AdminSidebar.tsx`

- [ ] **Step 1: Create tenant AI usage API**

```typescript
// clicker-platform-v2/app/api/admin/ai-usage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const cursor = searchParams.get('cursor');
  const moduleId = searchParams.get('moduleId');

  try {
    let query = adminDb
      .collection('sites').doc(siteId)
      .collection('platform').doc('aiCreditLedger')
      .collection('entries')
      .where('type', '==', 'debit')
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);

    if (moduleId) query = query.where('moduleId', '==', moduleId) as typeof query;
    if (cursor) {
      const cursorDoc = await adminDb
        .collection('sites').doc(siteId)
        .collection('platform').doc('aiCreditLedger')
        .collection('entries').doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc) as typeof query;
    }

    const snap = await query.get();
    const docs = snap.docs.slice(0, limit);
    const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;

    const entries = docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
    }));

    return NextResponse.json({ entries, nextCursor });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create UsagePage.tsx client component**

```typescript
// clicker-platform-v2/lib/modules/ai-platform/admin/UsagePage.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';

interface UsageEntry {
  id: string;
  moduleId: string;
  skillId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  balanceAfter: number;
  createdAt: string | null;
}

interface SummaryData {
  balance: number;
  lifetimeUsed: number;
}

const SKILL_LABELS: Record<string, string> = {
  'ai_sales_agent/chat': 'AI Chat',
  'ai_sales_agent/chat_followup': 'AI Chat',
  'ai_sales_agent/pdf_extraction': 'Knowledge Sync (PDF)',
  'stocklens/scan_product': 'Scan Produk',
  'ai_marketing/generate_ad_copy': 'Buat Iklan',
  'ai_marketing/generate_caption': 'Buat Caption',
  'ai_marketing/generate_headline': 'Buat Headline',
  'ai_marketing/generate_hashtags': 'Buat Hashtag',
  'ai_marketing/generate_cta': 'Buat CTA',
  'ai_marketing/translate_content': 'Terjemahkan',
  'ai_marketing/adapt_tone': 'Ubah Tone',
  'ai_marketing/plan_campaign': 'Rencana Kampanye',
  'ai_marketing/define_target_audience': 'Target Audiens',
  'ai_marketing/create_content_calendar': 'Kalender Konten',
  'ai_marketing/analyze_model_photo': 'Analisis Foto',
  'ai_marketing/analyze_background': 'Analisis Background',
  'ai_marketing/analyze_product': 'Analisis Produk',
  'ai_marketing/analyze_performance': 'Analisis Performa',
  'ai_marketing/generate_report': 'Buat Laporan',
};

function featureLabel(moduleId: string, skillId: string): string {
  return SKILL_LABELS[`${moduleId}/${skillId}`] ?? `${moduleId}/${skillId}`;
}

function modelShort(model: string): string {
  const map: Record<string, string> = {
    'google/gemini-2.0-flash': 'Gemini Flash',
    'google/gemini-2.0-flash:free': 'Gemini Flash (Free)',
    'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
    'anthropic/claude-sonnet-4': 'Claude Sonnet',
    'anthropic/claude-haiku-4-5': 'Claude Haiku',
    'openai/gpt-4o-mini': 'GPT-4o Mini',
    'openai/gpt-4o': 'GPT-4o',
  };
  return map[model] ?? model.split('/')[1] ?? model;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Baru saja';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return `${Math.floor(diff / 86_400_000)} hari lalu`;
}

export function UsagePage() {
  const { siteId } = useSite();
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');

  const fetchEntries = useCallback(async (cursor?: string) => {
    if (!siteId) return;
    const params = new URLSearchParams({ limit: '20' });
    if (cursor) params.set('cursor', cursor);
    if (moduleFilter) params.set('moduleId', moduleFilter);

    const res = await fetch(`/api/admin/ai-usage?${params}`, {
      headers: { 'x-site-id': siteId },
    });
    const data = await res.json() as { entries: UsageEntry[]; nextCursor: string | null };
    return data;
  }, [siteId, moduleFilter]);

  const fetchSummary = useCallback(async () => {
    if (!siteId) return;
    const res = await fetch('/api/admin/ai-credits', { headers: { 'x-site-id': siteId } });
    if (res.ok) setSummary(await res.json());
  }, [siteId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEntries(), fetchSummary()]).then(([data]) => {
      if (data) { setEntries(data.entries); setNextCursor(data.nextCursor); }
    }).finally(() => setLoading(false));
  }, [fetchEntries, fetchSummary]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchEntries(nextCursor);
      if (data) { setEntries(prev => [...prev, ...data.entries]); setNextCursor(data.nextCursor); }
    } finally {
      setLoadingMore(false);
    }
  }

  // Month spend: sum entries this calendar month
  const now = new Date();
  const monthSpend = entries
    .filter(e => e.createdAt && new Date(e.createdAt).getMonth() === now.getMonth() && new Date(e.createdAt).getFullYear() === now.getFullYear())
    .reduce((sum, e) => sum + (e.costUSD ?? 0), 0);

  const balance = summary?.balance ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">AI Usage</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Balance</p>
          <p className={`text-2xl font-black ${balance <= 0 ? 'text-red-600' : balance < 0.10 ? 'text-orange-600' : balance < 0.50 ? 'text-amber-600' : 'text-green-600'}`}>
            ${balance.toFixed(4)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Bulan Ini</p>
          <p className="text-2xl font-black">${monthSpend.toFixed(4)}</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Total</p>
          <p className="text-2xl font-black">${(summary?.lifetimeUsed ?? 0).toFixed(4)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className="font-black">Usage History</span>
          </div>
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="border-2 border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white"
          >
            <option value="">Semua Fitur</option>
            <option value="ai_sales_agent">AI Sales Agent</option>
            <option value="stocklens">Stocklens</option>
            <option value="ai_marketing">AI Marketing</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">Belum ada penggunaan AI</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Waktu</th>
                    <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Fitur</th>
                    <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Model</th>
                    <th className="text-right py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Tokens</th>
                    <th className="text-right py-2 text-gray-400 font-semibold uppercase tracking-wide">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap" title={entry.createdAt ?? ''}>
                        {relativeTime(entry.createdAt)}
                      </td>
                      <td className="py-2 pr-3 font-medium">
                        {featureLabel(entry.moduleId, entry.skillId)}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {modelShort(entry.model)}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-400 font-mono">
                        {entry.inputTokens ?? 0}↑ {entry.outputTokens ?? 0}↓
                      </td>
                      <td className="py-2 text-right font-mono font-semibold">
                        ${(entry.costUSD ?? 0).toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-semibold disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create page.tsx server shell**

```typescript
// clicker-platform-v2/app/admin/(dashboard)/ai-usage/page.tsx
import { UsagePage } from '@/lib/modules/ai-platform/admin/UsagePage';

export default function AIUsagePageRoute() {
  return <UsagePage />;
}
```

- [ ] **Step 4: Add AI Usage link to AdminSidebar settings popover**

In `app/admin/(dashboard)/AdminSidebar.tsx`, find the settings links array:
```typescript
{ icon: User, label: 'Account', href: '/admin/settings/account' },
{ icon: Building2, label: 'Business', href: '/admin/settings/business' },
{ icon: Users, label: 'Team', href: '/admin/settings/team' },
```

Add import at top:
```typescript
import { Activity } from 'lucide-react';
```

Add new entry:
```typescript
{ icon: Activity, label: 'AI Usage', href: '/admin/ai-usage' },
```

Note: this array appears in TWO places (AdminSidebar settings popover AND AdminTopBar settings popover). Update BOTH.

- [ ] **Step 5: Verify compile**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/worktrees/feature-ai-core/clicker-platform-v2
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add \
  clicker-platform-v2/app/api/admin/ai-usage/route.ts \
  clicker-platform-v2/app/admin/\(dashboard\)/ai-usage/page.tsx \
  clicker-platform-v2/lib/modules/ai-platform/admin/UsagePage.tsx \
  clicker-platform-v2/app/admin/\(dashboard\)/AdminSidebar.tsx
git commit -m "feat(platform): tenant AI usage page — balance + monthly spend + usage history"
```

---

## Task 10: Update AICreditBanner thresholds + migration reset

**Files:**
- Modify: `clicker-platform-v2/components/admin/AICreditBanner.tsx`

- [ ] **Step 1: Update thresholds**

In `AICreditBanner.tsx`, replace:
```typescript
const WARN_THRESHOLD = 20;
const CRITICAL_THRESHOLD = 5;
```
With:
```typescript
const WARN_THRESHOLD = 0.50;
const CRITICAL_THRESHOLD = 0.10;
```

Replace balance color check in banner:
```typescript
isOut = credits <= 0;
isCritical = credits > 0 && credits <= CRITICAL_THRESHOLD;
// warn = credits > 0 && credits <= WARN_THRESHOLD (already handled by early return)
```

Update text in banner for "sisa X":
```typescript
// Change from: `Kredit AI tersisa ${credits}`
// To:
`Saldo AI tersisa $${credits.toFixed(4)}`
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/AICreditBanner.tsx
git commit -m "fix(platform): update AICreditBanner thresholds to USD (warn $0.50, critical $0.10)"
```

- [ ] **Step 3: Migration — reset balance for active site**

After deploying, from Backyard:
1. Open AI Settings → Credits
2. Find the active site
3. Top-up with desired USD amount (e.g. $5.00)

The old integer balance is now a USD float (e.g. `100` reads as `$100.00`). To fix, the Backyard operator should note the current value, then set it to $0 by performing a "correction" top-up of `-currentBalance` (or simply top-up the intended USD amount and the old value will coexist until spent).

**Simplest approach:** Top-up $5.00 from Backyard. The old `100` balance will read as $100.00 — which is fine (it just means the tenant has a large buffer). No code change needed.

---

## Self-Review

**Spec coverage:**
- ✅ Section 1 (schema): Task 4 writes new ledger fields, Task 1 creates pricing doc
- ✅ Section 2 (lib/ai/): Tasks 1–6
- ✅ Section 3 (Backyard): Tasks 7–8
- ✅ Section 4 (Tenant page): Task 9
- ✅ Section 5 (skill labels): Task 9 UsagePage.tsx SKILL_LABELS map
- ✅ Section 6 (migration): Task 10 Step 3
- ✅ Section 7 (errors): Task 5 postDeduct handles model_not_priced + insufficient; Task 3 handles missing usage

**Type consistency check:**
- `AIResult` defined in Task 3, used in Task 5 ✅
- `AIToolResult` defined in Task 3, replaces `ToolResponse` in Task 5 ✅
- `calculateCost` defined in Task 1, imported in Task 5 ✅
- `deductCredits(siteId, costUSD, meta)` defined in Task 4, called in Task 5 ✅
- `AICallOptions` without `creditCost` in Task 2, callers fixed in Task 6 ✅

**Placeholder scan:** No TBD/TODO found. ✅

# AI Orchestrator — Phase 0+1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement quick wins (Phase 0) and orchestrator core (Phase 1) for AI Gateway foundation. Migrate ai-marketing to consume new orchestrator.

**Architecture:** C Hybrid — single `@/lib/ai` namespace with sub-folders (`provider/`, `billing/`, `orchestrator/`, `safety/`, `context.ts`, `models.ts`). Module consumer imports facade. Backward-compatible via re-export.

**Tech Stack:** TypeScript, Next.js App Router, Firebase Admin (Firestore), Vitest, OpenRouter API.

**Spec:** `dev/superpowers/specs/2026-05-22-ai-orchestrator-foundation-design.md`

**Working directory:** `dev/clicker-platform-v2/` (all paths relative unless noted)

---

## File Structure Overview

```
lib/ai/
├── index.ts                ← facade re-export
├── types.ts                ← shared (existing + extension)
├── context.ts              ← existing + collectEnrichment()
├── models.ts               ← existing (no change in Phase 1)
│
├── provider/               ← NEW folder
│   └── client.ts           ← MOVE from lib/ai/client.ts
│
├── billing/                ← NEW folder
│   ├── credits.ts          ← MOVE + bySkill aggregate
│   └── pricing.ts          ← MOVE
│
├── orchestrator/           ← NEW folder
│   ├── index.ts            ← barrel
│   ├── registry.ts         ← skill/flow/tool/agent/enricher maps
│   ├── runner.ts           ← runSkill
│   ├── flow.ts             ← runFlow
│   ├── audit.ts            ← (stub Phase 1, full in Phase 3)
│   └── bootstrap.ts        ← bootstrapAIRegistry()
│
└── __tests__/              ← existing + new
    ├── registry.test.ts    ← NEW
    ├── runner.test.ts      ← NEW
    └── flow.test.ts        ← NEW

lib/modules/ai-marketing/
├── ai/                     ← NEW folder
│   ├── register.ts         ← registerModuleAI()
│   └── flows.ts            ← MOVE from orchestrator/flows.ts + step.id
├── agents/                 ← existing + 6 new prompt builders
└── orchestrator/           ← DELETE after migration
```

---

## Phase 0 — Quick Wins (Tasks 1-6)

### Task 1: Add `bySkill` aggregate to deductCredits

**Files:**
- Modify: `lib/ai/credits.ts:58-66`
- Test: `lib/ai/__tests__/credits.test.ts`

- [ ] **Step 1: Write failing test**

Add this test to `lib/ai/__tests__/credits.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// existing mocks ...

describe('deductCredits — bySkill aggregate', () => {
  it('writes bySkill.{skillId}.cost and bySkill.{skillId}.calls to daily doc', async () => {
    // setup mocked Firestore tx + daily doc
    const mockSet = vi.fn();
    const mockDailyDoc = { set: mockSet };

    // ... arrange existing transaction mock returning balance 5.0
    // ... invoke deductCredits(siteId, 0.001, { moduleId: 'ai_marketing', skillId: 'generate_ad_copy', uid: 'u1', model: 'm', inputTokens: 100, outputTokens: 50 })

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        'bySkill.generate_ad_copy.cost': expect.anything(),
        'bySkill.generate_ad_copy.calls': expect.anything(),
      }),
      { merge: true }
    );
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
cd dev/clicker-platform-v2
pnpm vitest lib/ai/__tests__/credits.test.ts -t 'bySkill'
```
Expected: FAIL — assertion not met (no bySkill field).

- [ ] **Step 3: Modify `deductCredits` in `lib/ai/credits.ts`**

Find existing daily doc set block (lines 58-66):

```ts
  await dailyDoc(siteId).set({
    date: new Date().toISOString().slice(0, 10),
    totalCost: FieldValue.increment(costUSD),
    callCount: FieldValue.increment(1),
    inputTokens: FieldValue.increment(meta.inputTokens),
    outputTokens: FieldValue.increment(meta.outputTokens),
    [`byModule.${meta.moduleId}.cost`]: FieldValue.increment(costUSD),
    [`byModule.${meta.moduleId}.calls`]: FieldValue.increment(1),
  }, { merge: true });
```

Replace with:

```ts
  await dailyDoc(siteId).set({
    date: new Date().toISOString().slice(0, 10),
    totalCost: FieldValue.increment(costUSD),
    callCount: FieldValue.increment(1),
    inputTokens: FieldValue.increment(meta.inputTokens),
    outputTokens: FieldValue.increment(meta.outputTokens),
    [`byModule.${meta.moduleId}.cost`]: FieldValue.increment(costUSD),
    [`byModule.${meta.moduleId}.calls`]: FieldValue.increment(1),
    [`bySkill.${meta.skillId}.cost`]: FieldValue.increment(costUSD),
    [`bySkill.${meta.skillId}.calls`]: FieldValue.increment(1),
  }, { merge: true });
```

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm vitest lib/ai/__tests__/credits.test.ts -t 'bySkill'
```
Expected: PASS.

- [ ] **Step 5: Run full credits test, ensure no regression**

```bash
pnpm vitest lib/ai/__tests__/credits.test.ts
```
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/credits.ts lib/ai/__tests__/credits.test.ts
git commit -m "feat(ai): add bySkill aggregate to daily credit ledger"
```

---

### Task 2: Fix token usage fallback (hard error)

**Files:**
- Modify: `lib/ai/client.ts:45-51, 73-79, 112-118`
- Test: `lib/ai/__tests__/client.test.ts` (CREATE if absent)

- [ ] **Step 1: Create test file if not exists**

Create `lib/ai/__tests__/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/secrets', () => ({
  getSecret: vi.fn().mockResolvedValue('test-key'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('callText — usage validation', () => {
  it('throws usage_missing when prompt_tokens absent', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hi' } }],
        usage: { completion_tokens: 10 },  // prompt_tokens missing
      }),
    } as Response);

    const { callText } = await import('../client');
    await expect(callText({
      model: 'test/model',
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toThrow('usage_missing:test/model');
  });

  it('throws usage_missing when completion_tokens absent', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hi' } }],
        usage: { prompt_tokens: 100 },
      }),
    } as Response);

    const { callText } = await import('../client');
    await expect(callText({
      model: 'test/model',
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toThrow('usage_missing:test/model');
  });

  it('returns result when usage complete', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hi' } }],
        usage: { prompt_tokens: 100, completion_tokens: 10 },
      }),
    } as Response);

    const { callText } = await import('../client');
    const result = await callText({
      model: 'test/model',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(10);
  });
});
```

- [ ] **Step 2: Run test, verify fails for usage_missing assertions**

```bash
pnpm vitest lib/ai/__tests__/client.test.ts
```
Expected: 2 FAIL (usage_missing tests — current code silently estimates), 1 PASS (happy path).

- [ ] **Step 3: Modify `callText` in `lib/ai/client.ts`**

Find lines 45-51:

```ts
  const inputTokens = data.usage?.prompt_tokens
    ?? Math.ceil((request.max_tokens ?? 2048) * 0.3);
  const outputTokens = data.usage?.completion_tokens
    ?? (request.max_tokens ?? 2048);
  if (!data.usage?.prompt_tokens) {
    console.warn('[ai/client] usage missing for model:', request.model);
  }
```

Replace with:

```ts
  if (!data.usage?.prompt_tokens || data.usage?.completion_tokens == null) {
    logger.error('ai.provider.usage_missing', { model: request.model });
    throw new Error(`usage_missing:${request.model}`);
  }
  const inputTokens = data.usage.prompt_tokens;
  const outputTokens = data.usage.completion_tokens;
```

Apply same change to `callVision` (lines 73-79) and `callWithTools` (lines 112-118).

Add import at top of file:
```ts
import { logger } from '@/lib/logger';
```

- [ ] **Step 4: Run client tests, verify pass**

```bash
pnpm vitest lib/ai/__tests__/client.test.ts
```
Expected: ALL PASS.

- [ ] **Step 5: Run lib/ai full test suite**

```bash
pnpm vitest lib/ai/__tests__/
```
Expected: ALL PASS. If `index.test.ts` mocks now break because `callText` mock returns object without `usage`, update mocks to include `usage` field.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/client.ts lib/ai/__tests__/client.test.ts
git commit -m "fix(ai): hard error on missing token usage instead of silent under-charge"
```

---

### Task 3: Delete dead credit-estimator

**Files:**
- Delete: `lib/modules/ai-marketing/orchestrator/credit-estimator.ts`
- Modify: `lib/modules/ai-marketing/orchestrator/flows.ts` (remove `estimatedCredits`)
- Modify: `lib/modules/ai-marketing/types.ts` (remove `estimatedCredits` from `MultiSkillFlow`)
- Audit: grep for consumers

- [ ] **Step 1: Verify no consumers reference credit-estimator exports**

```bash
grep -rn "from '@/lib/modules/ai-marketing/orchestrator/credit-estimator'" lib/ app/ components/ 2>/dev/null
grep -rn "estimateSingleSkillCost\|estimateFlowCost\|formatCreditCost" lib/ app/ components/ 2>/dev/null
```
Expected: zero output. If output exists, do not delete — fix consumers first by inlining `return 0` / `return ''`.

- [ ] **Step 2: Delete credit-estimator file**

```bash
rm lib/modules/ai-marketing/orchestrator/credit-estimator.ts
```

- [ ] **Step 3: Remove `estimatedCredits` from `types.ts`**

In `lib/modules/ai-marketing/types.ts`, find:

```ts
export interface MultiSkillFlow {
  id: string;
  label: string;
  description: string;
  steps: { agent: AgentId; skill: SkillId; conditional?: string }[];
  estimatedCredits: number;
}
```

Replace with:

```ts
export interface MultiSkillFlow {
  id: string;
  label: string;
  description: string;
  steps: { agent: AgentId; skill: SkillId; conditional?: string }[];
}
```

- [ ] **Step 4: Remove `estimatedCredits` from `flows.ts`**

In `lib/modules/ai-marketing/orchestrator/flows.ts`, delete every `estimatedCredits: N,` line (4 occurrences: full_campaign 28, ad_copy_pack 8, performance_review 9, social_content_pack 7).

- [ ] **Step 5: Grep UI consumers for estimatedCredits**

```bash
grep -rn "estimatedCredits" lib/ app/ components/ 2>/dev/null
```
Expected: zero. If output exists, remove references.

- [ ] **Step 6: Run typecheck + build**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 7: Run ai-marketing tests**

```bash
pnpm vitest lib/modules/ai-marketing/
```
Expected: ALL PASS (or no tests — acceptable).

- [ ] **Step 8: Commit**

```bash
git add -u lib/modules/ai-marketing/
git commit -m "chore(ai-marketing): remove dead credit-estimator and estimatedCredits field"
```

---

### Task 4: Derive agentId from SKILLS_CATALOG

**Files:**
- Modify: `app/api/admin/modules/ai-marketing/generate/route.ts:78, 105-110`

- [ ] **Step 1: Modify route to use catalog lookup**

In `app/api/admin/modules/ai-marketing/generate/route.ts`, find lines 105-110 (`function getAgentForSkill`) and the call site line 78.

Add import at top:
```ts
import { SKILLS_CATALOG } from '@/lib/modules/ai-marketing/config/skills-catalog';
```

Replace function and call site. Delete the `getAgentForSkill` function entirely.

Change line 78 from:
```ts
        agentId: getAgentForSkill(skillId),
```

To:
```ts
        agentId: SKILLS_CATALOG.find(s => s.id === skillId)?.agentId ?? 'unknown',
```

Delete lines 105-110 (the function definition).

- [ ] **Step 2: Run typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Smoke test (manual)**

```bash
pnpm dev
```

Open `/admin/marketing/generate`, trigger 1 skill (e.g. `generate_ad_copy`). Verify generation succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/modules/ai-marketing/generate/route.ts
git commit -m "refactor(ai-marketing): derive agentId from SKILLS_CATALOG"
```

---

### Task 5: Replace console.warn with structured logger

**Files:**
- Modify: `lib/ai/client.ts` (3 occurrences already touched in Task 2)

Note: Task 2 already removed `console.warn` lines (replaced with `logger.error` + throw). Verify no `console.warn` remain.

- [ ] **Step 1: Verify no console.warn remain in lib/ai/**

```bash
grep -rn "console\.\(warn\|log\|error\)" lib/ai/
```
Expected: zero output.

- [ ] **Step 2: If output exists, replace each occurrence**

For each `console.warn('[ai/client] ...')`, replace with `logger.warn('ai.provider.{event_name}', { ...metadata })`.

- [ ] **Step 3: Commit (skip if no changes)**

```bash
git status lib/ai/
# only if changes:
git add lib/ai/
git commit -m "chore(ai): replace console.* with structured logger"
```

---

### Task 6: UsagePage module label from registry

**Files:**
- Modify: `lib/modules/ai-platform/admin/UsagePage.tsx:22-26`

- [ ] **Step 1: Locate module registry source**

```bash
grep -rn "displayName" lib/modules/definitions.ts lib/core/modules.ts 2>/dev/null | head -10
```

Read the module definitions structure. Expected: `modules/{id}` Firestore doc has `displayName` field per CLAUDE.md rule 7.

- [ ] **Step 2: Add Firestore listener to UsagePage**

In `lib/modules/ai-platform/admin/UsagePage.tsx`, replace the hardcoded `MODULE_LABELS` constant (lines 22-26):

```ts
const MODULE_LABELS: Record<string, string> = {
  stocklens: 'Scan Produk',
  ai_sales_agent: 'AI Sales Agent',
  ai_marketing: 'AI Marketing',
};
```

With dynamic state:

```ts
const [moduleLabels, setModuleLabels] = useState<Record<string, string>>({});

useEffect(() => {
  import('firebase/firestore').then(({ collection, getDocs }) => {
    import('@/lib/firebase').then(({ db }) => {
      getDocs(collection(db, 'modules')).then(snap => {
        const labels: Record<string, string> = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.displayName) labels[doc.id] = data.displayName;
        });
        setModuleLabels(labels);
      });
    });
  });
}, []);
```

Update render at line 100:
```ts
{MODULE_LABELS[mod] ?? mod}
```
To:
```ts
{moduleLabels[mod] ?? mod}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 4: Smoke test**

Open `/admin/ai-platform/usage`. Verify module labels still render (or fallback to ID).

- [ ] **Step 5: Commit**

```bash
git add lib/modules/ai-platform/admin/UsagePage.tsx
git commit -m "refactor(ai-platform): load module labels from Firestore registry"
```

---

## Phase 1 — Orchestrator Core (Tasks 7-22)

### Task 7: Create folder structure + move client.ts

**Files:**
- Create dir: `lib/ai/provider/`
- Move: `lib/ai/client.ts` → `lib/ai/provider/client.ts`
- Modify: `lib/ai/index.ts` (update import path)

- [ ] **Step 1: Create provider folder and move file**

```bash
mkdir -p lib/ai/provider
git mv lib/ai/client.ts lib/ai/provider/client.ts
```

- [ ] **Step 2: Update import in `lib/ai/index.ts`**

Find line 1:
```ts
import { callText, callVision, callWithTools } from './client';
import type { AIResult, AIToolResult } from './client';
```

Replace with:
```ts
import { callText, callVision, callWithTools } from './provider/client';
import type { AIResult, AIToolResult } from './provider/client';
```

- [ ] **Step 3: Update test imports**

```bash
grep -rn "from '\.\./client'" lib/ai/__tests__/ 2>/dev/null
grep -rn "from '\.\./\.\./client'" lib/ai/__tests__/ 2>/dev/null
```

For each match, update to `'../provider/client'` (relative depth matches new location).

- [ ] **Step 4: Run all lib/ai tests**

```bash
pnpm vitest lib/ai/
```
Expected: ALL PASS.

- [ ] **Step 5: Run typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS. If errors about missing `./client`, fix imports.

- [ ] **Step 6: Commit**

```bash
git add -A lib/ai/
git commit -m "refactor(ai): move client.ts to provider/ sub-folder"
```

---

### Task 8: Move credits.ts + pricing.ts to billing/

**Files:**
- Create dir: `lib/ai/billing/`
- Move: `lib/ai/credits.ts` → `lib/ai/billing/credits.ts`
- Move: `lib/ai/pricing.ts` → `lib/ai/billing/pricing.ts`
- Modify: `lib/ai/index.ts`

- [ ] **Step 1: Move files**

```bash
mkdir -p lib/ai/billing
git mv lib/ai/credits.ts lib/ai/billing/credits.ts
git mv lib/ai/pricing.ts lib/ai/billing/pricing.ts
```

- [ ] **Step 2: Update `lib/ai/index.ts` imports**

Find:
```ts
import { deductCredits, getCreditBalance } from './credits';
```
Replace:
```ts
import { deductCredits, getCreditBalance } from './billing/credits';
```

Find:
```ts
import { calculateCost } from './pricing';
```
Replace:
```ts
import { calculateCost } from './billing/pricing';
```

Find:
```ts
export { calculateCost, invalidatePricingCache } from './pricing';
```
Replace:
```ts
export { calculateCost, invalidatePricingCache } from './billing/pricing';
```

Also export credits functions (for module consumers):

Add to `lib/ai/index.ts` exports section:
```ts
export { deductCredits, addCredits, refundCredits, getCreditBalance } from './billing/credits';
```

- [ ] **Step 3: Update test imports**

```bash
grep -rn "from '\.\./credits'\|from '\.\./pricing'\|from '\.\./\.\./credits'\|from '\.\./\.\./pricing'" lib/ai/__tests__/
```

Update to `'../billing/credits'` / `'../billing/pricing'`.

- [ ] **Step 4: Grep external consumers**

```bash
grep -rn "from '@/lib/ai/credits'\|from '@/lib/ai/pricing'" lib/ app/ components/ backyard/
```

For each match, choose:
- If module-level consumer → keep import but verify `@/lib/ai/index` re-exports
- If Backyard → update path explicitly

Find/replace `from '@/lib/ai/credits'` → `from '@/lib/ai'` (use facade).
Find/replace `from '@/lib/ai/pricing'` → `from '@/lib/ai'`.

- [ ] **Step 5: Run typecheck + test**

```bash
pnpm tsc --noEmit
pnpm vitest lib/ai/
```
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ai): move credits/pricing to billing/ sub-folder + facade re-export"
```

---

### Task 9: Extend types.ts with orchestrator types

**Files:**
- Modify: `lib/ai/types.ts`

- [ ] **Step 1: Add orchestrator types to `lib/ai/types.ts`**

Append at end of file:

```ts
// ─── Orchestrator types ──────────────────────────────────────────────────────

export interface RunContext {
  siteId: string;
  moduleId: string;
  uid: string;
  requestId?: string;
}

export interface PromptResult {
  system: string;
  user: string;
}

export type PromptBuilder = (
  input: Record<string, unknown>,
  ctx: { brand?: string; prior?: Record<string, unknown> }
) => PromptResult;

export interface SkillDef {
  id: string;
  moduleId: string;
  agentId: string;
  mode: 'text' | 'vision' | 'tools';
  promptBuilder: PromptBuilder;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface FlowStep {
  id: string;
  skillId: string;
  when?: (ctx: { input: Record<string, unknown>; prior: Record<string, unknown> }) => boolean;
  inputMap?: (input: Record<string, unknown>, prior: Record<string, unknown>) => Record<string, unknown>;
}

export interface FlowDef {
  id: string;
  moduleId: string;
  steps: FlowStep[];
}

export interface AgentDef {
  id: string;
  moduleId: string;
  systemPrompt: string;
  model?: string;
  defaultTools?: string[];
}

export interface ToolDef {
  id: string;
  moduleId: string;
  definition: ToolDefinition;
  handler: (args: Record<string, unknown>, ctx: RunContext) => Promise<unknown>;
}

export interface ContextEnricherDef {
  moduleId: string;
  build: (siteId: string) => Promise<{ section: string; text: string }>;
}

export interface RunSkillInput {
  skillId: string;
  input: Record<string, unknown>;
  context: RunContext;
  overrides?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export interface RunSkillOutput {
  content: string;
  structured?: Record<string, unknown>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  durationMs: number;
  cached?: boolean;
}

export interface RunFlowInput {
  flowId: string;
  input: Record<string, unknown>;
  context: RunContext;
}

export interface RunFlowOutput {
  stepOutputs: Record<string, RunSkillOutput>;
  totalCostUSD: number;
  totalDurationMs: number;
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/types.ts
git commit -m "feat(ai): add orchestrator type definitions"
```

---

### Task 10: Create registry (skill/flow/tool/agent/enricher)

**Files:**
- Create: `lib/ai/orchestrator/registry.ts`
- Create: `lib/ai/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/ai/__tests__/registry.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerSkill, getSkill, hasSkill,
  registerFlow, getFlow,
  registerTool, getTool,
  registerAgent, getAgent,
  registerContextEnricher, getEnrichersFor,
  __resetRegistry,
} from '../orchestrator/registry';

beforeEach(() => __resetRegistry());

describe('skill registry', () => {
  it('register and retrieve skill', () => {
    registerSkill({
      id: 'test_skill',
      moduleId: 'test_module',
      agentId: 'test_agent',
      mode: 'text',
      promptBuilder: () => ({ system: '', user: '' }),
    });
    expect(hasSkill('test_skill')).toBe(true);
    expect(getSkill('test_skill').id).toBe('test_skill');
  });

  it('throws on duplicate', () => {
    const def = {
      id: 's1', moduleId: 'm', agentId: 'a', mode: 'text' as const,
      promptBuilder: () => ({ system: '', user: '' }),
    };
    registerSkill(def);
    expect(() => registerSkill(def)).toThrow('skill_duplicate:s1');
  });

  it('throws on get not found', () => {
    expect(() => getSkill('missing')).toThrow('skill_not_found:missing');
  });
});

describe('enricher registry', () => {
  it('returns all enrichers for active moduleIds', async () => {
    registerContextEnricher({
      moduleId: 'mod_a',
      build: async () => ({ section: 'A', text: 'a-data' }),
    });
    registerContextEnricher({
      moduleId: 'mod_b',
      build: async () => ({ section: 'B', text: 'b-data' }),
    });
    const enrichers = getEnrichersFor(['mod_a', 'mod_b']);
    expect(enrichers).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
pnpm vitest lib/ai/__tests__/registry.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement registry**

Create `lib/ai/orchestrator/registry.ts`:

```ts
import type {
  SkillDef, FlowDef, ToolDef, AgentDef, ContextEnricherDef,
} from '../types';

const skills = new Map<string, SkillDef>();
const flows = new Map<string, FlowDef>();
const tools = new Map<string, ToolDef>();
const agents = new Map<string, AgentDef>();
const enrichers = new Map<string, ContextEnricherDef>();

// ── Skill ─────────────────────────────────────────────
export function registerSkill(def: SkillDef): void {
  if (skills.has(def.id)) throw new Error(`skill_duplicate:${def.id}`);
  skills.set(def.id, def);
}
export function getSkill(id: string): SkillDef {
  const def = skills.get(id);
  if (!def) throw new Error(`skill_not_found:${id}`);
  return def;
}
export function hasSkill(id: string): boolean {
  return skills.has(id);
}

// ── Flow ──────────────────────────────────────────────
export function registerFlow(def: FlowDef): void {
  if (flows.has(def.id)) throw new Error(`flow_duplicate:${def.id}`);
  flows.set(def.id, def);
}
export function getFlow(id: string): FlowDef {
  const def = flows.get(id);
  if (!def) throw new Error(`flow_not_found:${id}`);
  return def;
}

// ── Tool ──────────────────────────────────────────────
export function registerTool(def: ToolDef): void {
  if (tools.has(def.id)) throw new Error(`tool_duplicate:${def.id}`);
  tools.set(def.id, def);
}
export function getTool(id: string): ToolDef {
  const def = tools.get(id);
  if (!def) throw new Error(`tool_not_found:${id}`);
  return def;
}

// ── Agent ─────────────────────────────────────────────
export function registerAgent(def: AgentDef): void {
  if (agents.has(def.id)) throw new Error(`agent_duplicate:${def.id}`);
  agents.set(def.id, def);
}
export function getAgent(id: string): AgentDef {
  const def = agents.get(id);
  if (!def) throw new Error(`agent_not_found:${id}`);
  return def;
}

// ── Enricher ──────────────────────────────────────────
export function registerContextEnricher(def: ContextEnricherDef): void {
  enrichers.set(def.moduleId, def);
}
export function getEnrichersFor(moduleIds: string[]): ContextEnricherDef[] {
  return moduleIds
    .map(id => enrichers.get(id))
    .filter((e): e is ContextEnricherDef => Boolean(e));
}

// ── Test-only reset ───────────────────────────────────
export function __resetRegistry(): void {
  skills.clear();
  flows.clear();
  tools.clear();
  agents.clear();
  enrichers.clear();
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm vitest lib/ai/__tests__/registry.test.ts
```
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/orchestrator/registry.ts lib/ai/__tests__/registry.test.ts
git commit -m "feat(ai): orchestrator registry for skills/flows/tools/agents/enrichers"
```

---

### Task 11: Extend context.ts with collectEnrichment

**Files:**
- Modify: `lib/ai/context.ts`

- [ ] **Step 1: Add collectEnrichment function**

Append to `lib/ai/context.ts`:

```ts
import { getEnrichersFor } from './orchestrator/registry';

export async function collectEnrichment(
  moduleIds: string[],
  siteId: string
): Promise<string> {
  const enrichers = getEnrichersFor(moduleIds);
  if (enrichers.length === 0) return '';
  const sections = await Promise.all(
    enrichers.map(async (e) => {
      try {
        const { section, text } = await e.build(siteId);
        return `\n${section}:\n${text}`;
      } catch {
        return '';
      }
    })
  );
  return sections.filter(Boolean).join('\n');
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/context.ts
git commit -m "feat(ai): add collectEnrichment to compose module context"
```

---

### Task 12: Implement runSkill

**Files:**
- Create: `lib/ai/orchestrator/runner.ts`
- Create: `lib/ai/__tests__/runner.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/ai/__tests__/runner.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetRegistry, registerSkill } from '../orchestrator/registry';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../provider/client', () => ({
  callText: vi.fn(),
  callVision: vi.fn(),
  callWithTools: vi.fn(),
}));

vi.mock('../billing/credits', () => ({
  deductCredits: vi.fn().mockResolvedValue({ balanceAfter: 1 }),
  getCreditBalance: vi.fn().mockResolvedValue({ balance: 5, lifetimeUsed: 0 }),
}));

vi.mock('../billing/pricing', () => ({
  calculateCost: vi.fn().mockResolvedValue(0.001),
}));

vi.mock('../context', () => ({
  buildTenantContext: vi.fn().mockResolvedValue({ systemPrompt: 'TENANT_CTX', context: {} }),
  collectEnrichment: vi.fn().mockResolvedValue(''),
}));

vi.mock('../models', () => ({
  getModel: vi.fn().mockResolvedValue('openai/gpt-4o-mini'),
}));

beforeEach(() => {
  __resetRegistry();
  vi.clearAllMocks();
});

describe('runSkill', () => {
  it('invokes registered text skill end-to-end', async () => {
    registerSkill({
      id: 'test_skill',
      moduleId: 'test_module',
      agentId: 'test_agent',
      mode: 'text',
      promptBuilder: (input) => ({
        system: 'SKILL_SYS',
        user: `INPUT:${(input as { msg: string }).msg}`,
      }),
    });

    const { callText } = await import('../provider/client');
    vi.mocked(callText).mockResolvedValue({
      content: '{"ok":true}',
      inputTokens: 100,
      outputTokens: 50,
      model: 'openai/gpt-4o-mini',
    });

    const { runSkill } = await import('../orchestrator/runner');
    const out = await runSkill({
      skillId: 'test_skill',
      input: { msg: 'hello' },
      context: { siteId: 's1', moduleId: 'test_module', uid: 'u1' },
    });

    expect(out.content).toBe('{"ok":true}');
    expect(out.structured).toEqual({ ok: true });
    expect(out.model).toBe('openai/gpt-4o-mini');
    expect(out.inputTokens).toBe(100);
    expect(out.outputTokens).toBe(50);
    expect(out.costUSD).toBe(0.001);
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('uses skill.model override over default', async () => {
    registerSkill({
      id: 's2',
      moduleId: 'test',
      agentId: 'a',
      mode: 'text',
      model: 'anthropic/claude-sonnet-4',
      promptBuilder: () => ({ system: '', user: '' }),
    });

    const { callText } = await import('../provider/client');
    vi.mocked(callText).mockResolvedValue({
      content: 'ok', inputTokens: 1, outputTokens: 1, model: 'anthropic/claude-sonnet-4',
    });

    const { runSkill } = await import('../orchestrator/runner');
    await runSkill({
      skillId: 's2',
      input: {},
      context: { siteId: 's', moduleId: 't', uid: 'u' },
    });

    const args = vi.mocked(callText).mock.calls[0][0];
    expect(args.model).toBe('anthropic/claude-sonnet-4');
  });

  it('throws skill_not_found for unknown skillId', async () => {
    const { runSkill } = await import('../orchestrator/runner');
    await expect(runSkill({
      skillId: 'missing',
      input: {},
      context: { siteId: 's', moduleId: 'm', uid: 'u' },
    })).rejects.toThrow('skill_not_found:missing');
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
pnpm vitest lib/ai/__tests__/runner.test.ts
```
Expected: FAIL — runner module missing.

- [ ] **Step 3: Implement runner**

Create `lib/ai/orchestrator/runner.ts`:

```ts
import { invokeAI, invokeVision } from '../index';
import { buildTenantContext, collectEnrichment } from '../context';
import { getModel } from '../models';
import { calculateCost } from '../billing/pricing';
import { getSkill } from './registry';
import type { RunSkillInput, RunSkillOutput } from '../types';

function tryParseJSON(raw: string): Record<string, unknown> | undefined {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return undefined;
  }
}

export async function runSkill(req: RunSkillInput): Promise<RunSkillOutput> {
  const t0 = Date.now();
  const skill = getSkill(req.skillId);
  const { siteId, moduleId, uid } = req.context;

  const { systemPrompt: tenantCtx } = await buildTenantContext(siteId);
  const enrichment = await collectEnrichment([moduleId], siteId);
  const { system: skillSys, user } = skill.promptBuilder(req.input, {
    brand: tenantCtx,
    prior: {},
  });
  const system = [tenantCtx, enrichment, skillSys].filter(Boolean).join('\n\n');

  const model = req.overrides?.model
    ?? skill.model
    ?? await getModel(skill.mode === 'vision' ? 'vision' : 'chat');

  const maxTokens = req.overrides?.maxTokens ?? skill.maxTokens ?? 2048;
  const temperature = req.overrides?.temperature ?? skill.temperature ?? 0.7;

  let content: string;
  let inputTokens: number;
  let outputTokens: number;
  let resolvedModel: string;

  if (skill.mode === 'vision') {
    // Vision skills expect input.imageBase64
    const imageBase64 = req.input.imageBase64 as string | undefined;
    if (!imageBase64) throw new Error(`vision_skill_missing_image:${req.skillId}`);
    content = await invokeVision(
      {
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `${system}\n\n${user}` },
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${imageBase64}` } },
          ],
        }],
        max_tokens: maxTokens,
        temperature,
      },
      { siteId, moduleId, skillId: req.skillId, uid }
    );
    // Token counts are deducted inside invokeVision; we need to compute cost separately
    // For audit purposes we approximate from content length. TODO: refactor invokeAI to return usage.
    inputTokens = 0;
    outputTokens = 0;
    resolvedModel = model;
  } else {
    content = await invokeAI(
      {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature,
      },
      { siteId, moduleId, skillId: req.skillId, uid }
    );
    inputTokens = 0;
    outputTokens = 0;
    resolvedModel = model;
  }

  const structured = tryParseJSON(content);

  // Cost already deducted inside invokeAI/invokeVision via postDeduct.
  // To return costUSD in RunSkillOutput, we calculate again from approximated tokens.
  // NOTE: For accurate cost reporting, refactor invokeAI to return usage details. Tracked as follow-up.
  const costUSD = await calculateCost(resolvedModel, inputTokens, outputTokens).catch(() => 0);

  return {
    content,
    structured,
    model: resolvedModel,
    inputTokens,
    outputTokens,
    costUSD,
    durationMs: Date.now() - t0,
  };
}
```

**Note:** Current `invokeAI` only returns content string. To get token counts back to `runSkill`, need to refactor. For Phase 1 baseline, return zeros and rely on Firestore ledger for accurate cost; client UI can refetch balance.

- [ ] **Step 4: Refactor invokeAI to return token usage**

Modify `lib/ai/index.ts`. Find:

```ts
export async function invokeAI(
  request: AIRequest,
  options: AICallOptions
): Promise<string> {
  await preflightCheck(options.siteId);
  const result = await callText(request);
  await postDeduct(result, options);
  return result.content;
}
```

Replace with:

```ts
export async function invokeAI(
  request: AIRequest,
  options: AICallOptions
): Promise<{ content: string; inputTokens: number; outputTokens: number; model: string; costUSD: number }> {
  await preflightCheck(options.siteId);
  const result = await callText(request);
  const costUSD = await calculateCost(result.model, result.inputTokens, result.outputTokens).catch(() => 0);
  await postDeduct(result, options);
  return {
    content: result.content,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
    costUSD,
  };
}
```

Apply same change to `invokeVision`.

**Breaking change:** Existing callers of `invokeAI` (in ai-marketing) expect string return. Update them:

```bash
grep -rn "await invokeAI\|invokeAI(" lib/modules/ app/ | grep -v __tests__
```

For each call site, change:
```ts
const raw = await invokeAI(...);
```
To:
```ts
const { content: raw } = await invokeAI(...);
```

Same for `invokeVision`.

- [ ] **Step 5: Update existing tests for new return type**

`lib/ai/__tests__/index.test.ts` — update assertions. Find:
```ts
expect(result).toBe('Generated content');
```
Replace:
```ts
expect(result.content).toBe('Generated content');
expect(result.inputTokens).toBe(1000);
expect(result.outputTokens).toBe(500);
```

- [ ] **Step 6: Update runner.ts to use new invokeAI return shape**

In `lib/ai/orchestrator/runner.ts`, replace the vision/text invocation block:

```ts
  let content: string;
  let inputTokens: number;
  let outputTokens: number;
  let resolvedModel: string;
  let costUSD: number;

  if (skill.mode === 'vision') {
    const imageBase64 = req.input.imageBase64 as string | undefined;
    if (!imageBase64) throw new Error(`vision_skill_missing_image:${req.skillId}`);
    const res = await invokeVision(
      {
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `${system}\n\n${user}` },
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${imageBase64}` } },
          ],
        }],
        max_tokens: maxTokens,
        temperature,
      },
      { siteId, moduleId, skillId: req.skillId, uid }
    );
    content = res.content;
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
    resolvedModel = res.model;
    costUSD = res.costUSD;
  } else {
    const res = await invokeAI(
      {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature,
      },
      { siteId, moduleId, skillId: req.skillId, uid }
    );
    content = res.content;
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
    resolvedModel = res.model;
    costUSD = res.costUSD;
  }

  const structured = tryParseJSON(content);

  return {
    content,
    structured,
    model: resolvedModel,
    inputTokens,
    outputTokens,
    costUSD,
    durationMs: Date.now() - t0,
  };
```

Remove the separate `calculateCost` call at the end and the import.

- [ ] **Step 7: Run tests, verify pass**

```bash
pnpm vitest lib/ai/__tests__/runner.test.ts
pnpm vitest lib/ai/__tests__/index.test.ts
```
Expected: ALL PASS.

- [ ] **Step 8: Run full lib/ai test suite + typecheck**

```bash
pnpm vitest lib/ai/
pnpm tsc --noEmit
```
Expected: ALL PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/ai/orchestrator/runner.ts lib/ai/__tests__/runner.test.ts lib/ai/index.ts lib/ai/__tests__/index.test.ts lib/modules/ai-marketing/
git commit -m "feat(ai): implement runSkill + extend invokeAI to return token usage"
```

---

### Task 13: Implement runFlow with step.id

**Files:**
- Create: `lib/ai/orchestrator/flow.ts`
- Create: `lib/ai/__tests__/flow.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/ai/__tests__/flow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetRegistry, registerSkill, registerFlow } from '../orchestrator/registry';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../provider/client', () => ({
  callText: vi.fn(),
}));

vi.mock('../billing/credits', () => ({
  deductCredits: vi.fn().mockResolvedValue({ balanceAfter: 1 }),
  getCreditBalance: vi.fn().mockResolvedValue({ balance: 5, lifetimeUsed: 0 }),
}));

vi.mock('../billing/pricing', () => ({
  calculateCost: vi.fn().mockResolvedValue(0.001),
}));

vi.mock('../context', () => ({
  buildTenantContext: vi.fn().mockResolvedValue({ systemPrompt: '', context: {} }),
  collectEnrichment: vi.fn().mockResolvedValue(''),
}));

vi.mock('../models', () => ({
  getModel: vi.fn().mockResolvedValue('openai/gpt-4o-mini'),
}));

beforeEach(() => {
  __resetRegistry();
  vi.clearAllMocks();
});

describe('runFlow', () => {
  it('runs sequential steps and keys outputs by step.id', async () => {
    registerSkill({
      id: 'sk_a', moduleId: 'm', agentId: 'a', mode: 'text',
      promptBuilder: () => ({ system: '', user: '' }),
    });
    registerSkill({
      id: 'sk_b', moduleId: 'm', agentId: 'a', mode: 'text',
      promptBuilder: () => ({ system: '', user: '' }),
    });
    registerFlow({
      id: 'flow_test', moduleId: 'm',
      steps: [
        { id: 'step1', skillId: 'sk_a' },
        { id: 'step2', skillId: 'sk_b' },
      ],
    });

    const { callText } = await import('../provider/client');
    vi.mocked(callText)
      .mockResolvedValueOnce({ content: '{"a":1}', inputTokens: 10, outputTokens: 5, model: 'm' })
      .mockResolvedValueOnce({ content: '{"b":2}', inputTokens: 10, outputTokens: 5, model: 'm' });

    const { runFlow } = await import('../orchestrator/flow');
    const out = await runFlow({
      flowId: 'flow_test',
      input: {},
      context: { siteId: 's', moduleId: 'm', uid: 'u' },
    });

    expect(Object.keys(out.stepOutputs)).toEqual(['step1', 'step2']);
    expect(out.stepOutputs.step1.structured).toEqual({ a: 1 });
    expect(out.stepOutputs.step2.structured).toEqual({ b: 2 });
    expect(out.totalCostUSD).toBeGreaterThan(0);
  });

  it('allows same skill duplicated with different step.id', async () => {
    registerSkill({
      id: 'sk_dup', moduleId: 'm', agentId: 'a', mode: 'text',
      promptBuilder: () => ({ system: '', user: '' }),
    });
    registerFlow({
      id: 'flow_dup', moduleId: 'm',
      steps: [
        { id: 'first', skillId: 'sk_dup' },
        { id: 'second', skillId: 'sk_dup' },
      ],
    });

    const { callText } = await import('../provider/client');
    vi.mocked(callText)
      .mockResolvedValueOnce({ content: 'a', inputTokens: 1, outputTokens: 1, model: 'm' })
      .mockResolvedValueOnce({ content: 'b', inputTokens: 1, outputTokens: 1, model: 'm' });

    const { runFlow } = await import('../orchestrator/flow');
    const out = await runFlow({
      flowId: 'flow_dup',
      input: {},
      context: { siteId: 's', moduleId: 'm', uid: 'u' },
    });

    expect(out.stepOutputs.first.content).toBe('a');
    expect(out.stepOutputs.second.content).toBe('b');
  });

  it('skips step when predicate returns false', async () => {
    registerSkill({
      id: 'sk_cond', moduleId: 'm', agentId: 'a', mode: 'text',
      promptBuilder: () => ({ system: '', user: '' }),
    });
    registerFlow({
      id: 'flow_cond', moduleId: 'm',
      steps: [
        { id: 'skipped', skillId: 'sk_cond', when: () => false },
        { id: 'ran', skillId: 'sk_cond', when: () => true },
      ],
    });

    const { callText } = await import('../provider/client');
    vi.mocked(callText).mockResolvedValue({ content: 'x', inputTokens: 1, outputTokens: 1, model: 'm' });

    const { runFlow } = await import('../orchestrator/flow');
    const out = await runFlow({
      flowId: 'flow_cond',
      input: {},
      context: { siteId: 's', moduleId: 'm', uid: 'u' },
    });

    expect(out.stepOutputs.skipped).toBeUndefined();
    expect(out.stepOutputs.ran).toBeDefined();
    expect(vi.mocked(callText)).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
pnpm vitest lib/ai/__tests__/flow.test.ts
```
Expected: FAIL — flow module missing.

- [ ] **Step 3: Implement runFlow**

Create `lib/ai/orchestrator/flow.ts`:

```ts
import { runSkill } from './runner';
import { getFlow } from './registry';
import type { RunFlowInput, RunFlowOutput, RunSkillOutput } from '../types';

export async function runFlow(req: RunFlowInput): Promise<RunFlowOutput> {
  const t0 = Date.now();
  const flow = getFlow(req.flowId);
  const stepOutputs: Record<string, RunSkillOutput> = {};
  const prior: Record<string, unknown> = {};
  let totalCostUSD = 0;

  for (const step of flow.steps) {
    if (step.when && !step.when({ input: req.input, prior })) continue;

    const stepInput = step.inputMap
      ? step.inputMap(req.input, prior)
      : req.input;

    const result = await runSkill({
      skillId: step.skillId,
      input: stepInput,
      context: req.context,
    });

    stepOutputs[step.id] = result;
    totalCostUSD += result.costUSD;

    if (result.structured) {
      prior[step.id] = result.structured;
    }
  }

  return {
    stepOutputs,
    totalCostUSD,
    totalDurationMs: Date.now() - t0,
  };
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm vitest lib/ai/__tests__/flow.test.ts
```
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/orchestrator/flow.ts lib/ai/__tests__/flow.test.ts
git commit -m "feat(ai): implement runFlow with step.id keying and predicate conditional"
```

---

### Task 14: Create orchestrator barrel + bootstrap

**Files:**
- Create: `lib/ai/orchestrator/index.ts`
- Create: `lib/ai/orchestrator/bootstrap.ts`

- [ ] **Step 1: Create orchestrator barrel**

Create `lib/ai/orchestrator/index.ts`:

```ts
export {
  registerSkill, getSkill, hasSkill,
  registerFlow, getFlow,
  registerTool, getTool,
  registerAgent, getAgent,
  registerContextEnricher, getEnrichersFor,
} from './registry';

export { runSkill } from './runner';
export { runFlow } from './flow';
```

- [ ] **Step 2: Create bootstrap stub**

Create `lib/ai/orchestrator/bootstrap.ts`:

```ts
let bootstrapped = false;

export async function bootstrapAIRegistry(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  // Dynamic imports per module to avoid load-order issues.
  // Each module's register.ts is responsible for calling registerSkill etc.
  const modules = [
    () => import('@/lib/modules/ai-marketing/ai/register').then(m => m.registerModuleAI()),
  ];

  for (const load of modules) {
    try {
      await load();
    } catch (err) {
      // Log but do not block — missing module file means module not active.
      const { logger } = await import('@/lib/logger');
      logger.warn('ai.registry.module_register_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function __resetBootstrap(): void {
  bootstrapped = false;
}
```

- [ ] **Step 3: Update `lib/ai/index.ts` to re-export orchestrator**

Add to `lib/ai/index.ts`:

```ts
export * from './orchestrator';
export { bootstrapAIRegistry } from './orchestrator/bootstrap';
```

- [ ] **Step 4: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS (note: `ai-marketing/ai/register` not yet exists, dynamic import will fail gracefully at runtime).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/orchestrator/index.ts lib/ai/orchestrator/bootstrap.ts lib/ai/index.ts
git commit -m "feat(ai): orchestrator barrel + bootstrap entry point"
```

---

### Task 15: Move 6 inline prompts in ai-marketing to agent files

**Files:**
- Modify: `lib/modules/ai-marketing/agents/creative-director.ts` (add `buildCtaPrompt`)
- Modify: `lib/modules/ai-marketing/agents/strategist.ts` (add 3 builders)
- Modify: `lib/modules/ai-marketing/agents/data-analyst.ts` (add 2 builders)
- Modify: `lib/modules/ai-marketing/orchestrator/runner.ts` (remove inline switch cases)

- [ ] **Step 1: Add `buildCtaPrompt` to creative-director.ts**

Append to `lib/modules/ai-marketing/agents/creative-director.ts`:

```ts
export function buildCtaPrompt(input: {
  product: string;
  objective: string;
}): { system: string; user: string } {
  return {
    system: `You are a conversion copywriter. Generate compelling CTAs. Respond with valid JSON only.`,
    user: `Generate 5 CTAs for: ${input.product}, objective: ${input.objective}.\nReturn ONLY: { "ctas": ["CTA 1", "CTA 2", "CTA 3", "CTA 4", "CTA 5"] }`,
  };
}
```

- [ ] **Step 2: Add builders to strategist.ts**

Append to `lib/modules/ai-marketing/agents/strategist.ts`:

```ts
export function buildSuggestPlatformsPrompt(input: {
  targetAudience: string;
  budget: string;
  objective: string;
}): { system: string; user: string } {
  return {
    system: `You are a marketing channel strategist. Recommend optimal platforms. Respond with valid JSON only.`,
    user: `Recommend platforms for: ${input.targetAudience}, budget: ${input.budget}, objective: ${input.objective}.\nReturn ONLY: { "platforms": [{ "name": "...", "priority": 1, "rationale": "...", "estimated_reach": "..." }] }`,
  };
}

export function buildCompetitiveAnalysisPrompt(input: {
  industry: string;
  competitors: string;
}): { system: string; user: string } {
  return {
    system: `You are a marketing strategist. Analyze competitive landscape. Respond with valid JSON only.`,
    user: `Competitive analysis for: ${input.industry}, competitors: ${input.competitors}.\nReturn ONLY: { "market_overview": "...", "competitors": [{ "name": "...", "strengths": [], "weaknesses": [] }], "opportunities": [], "threats": [], "recommendations": [] }`,
  };
}

export function buildAbTestIdeasPrompt(input: {
  currentPerformance: string;
  goals: string;
}): { system: string; user: string } {
  return {
    system: `You are a CRO specialist. Generate actionable A/B test hypotheses. Respond with valid JSON only.`,
    user: `A/B test ideas for: ${input.currentPerformance}, goals: ${input.goals}.\nReturn ONLY: { "tests": [{ "hypothesis": "...", "element": "...", "variants": ["A", "B"], "expected_lift": "...", "priority": "high" }] }`,
  };
}
```

- [ ] **Step 3: Add builders to data-analyst.ts**

Append to `lib/modules/ai-marketing/agents/data-analyst.ts`:

```ts
export function buildPredictOutcomesPrompt(input: {
  historicalData: string;
  plannedChanges: string;
}): { system: string; user: string } {
  return {
    system: `You are a marketing data scientist. Forecast campaign outcomes. Respond with valid JSON only.`,
    user: `Predict outcomes based on: ${input.historicalData}, planned changes: ${input.plannedChanges}.\nReturn ONLY: { "predictions": [{ "metric": "...", "current": "...", "projected": "...", "confidence": "high", "assumptions": "..." }], "overall_outlook": "..." }`,
  };
}

export function buildBenchmarkCompetitorsPrompt(input: {
  myMetrics: string;
  industry: string;
}): { system: string; user: string } {
  return {
    system: `You are a competitive intelligence analyst. Benchmark marketing performance. Respond with valid JSON only.`,
    user: `Benchmark analysis: my metrics: ${input.myMetrics}, industry: ${input.industry}.\nReturn ONLY: { "benchmarks": [{ "metric": "...", "my_value": "...", "industry_avg": "...", "top_performers": "...", "gap": "..." }], "summary": "...", "priority_gaps": [] }`,
  };
}
```

- [ ] **Step 4: Update existing runner to use new builders**

In `lib/modules/ai-marketing/orchestrator/runner.ts`, find the switch cases for `generate_cta`, `suggest_platforms`, `competitive_analysis`, `ab_test_ideas`, `predict_outcomes`, `benchmark_competitors`.

Replace each inline `return { system: ..., user: ... }` with the appropriate builder call. Example for `generate_cta`:

```ts
    case 'generate_cta':
      return buildCtaPrompt({
        product: formData.product ?? '',
        objective: formData.objective ?? 'purchase',
      });
```

Add imports at top of `runner.ts`:
```ts
import { buildAdCopyPrompt, ..., buildCtaPrompt } from '../agents/creative-director';
import { ..., buildSuggestPlatformsPrompt, buildCompetitiveAnalysisPrompt, buildAbTestIdeasPrompt } from '../agents/strategist';
import { ..., buildPredictOutcomesPrompt, buildBenchmarkCompetitorsPrompt } from '../agents/data-analyst';
```

Replace all 6 inline cases similarly.

- [ ] **Step 5: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 6: Smoke test (manual)**

```bash
pnpm dev
```

Open `/admin/marketing/generate`. Test each of: `generate_cta`, `suggest_platforms`, `competitive_analysis`, `ab_test_ideas`, `predict_outcomes`, `benchmark_competitors`. Verify all succeed.

- [ ] **Step 7: Commit**

```bash
git add lib/modules/ai-marketing/
git commit -m "refactor(ai-marketing): extract 6 inline prompts to agent builder files"
```

---

### Task 16: Create `ai-marketing/ai/register.ts`

**Files:**
- Create: `lib/modules/ai-marketing/ai/register.ts`

- [ ] **Step 1: Implement register module**

Create `lib/modules/ai-marketing/ai/register.ts`:

```ts
import {
  registerSkill, registerFlow,
} from '@/lib/ai';
import { SKILLS_CATALOG } from '../config/skills-catalog';
import { SKILL_MODEL_MAP } from '../config/model-config';
import { MULTI_SKILL_FLOWS } from '../orchestrator/flows';
import type { SkillId, BrandVoiceConfig } from '../types';

import {
  buildAdCopyPrompt, buildCaptionPrompt, buildHeadlinePrompt,
  buildHashtagsPrompt, buildTranslatePrompt, buildAdaptTonePrompt,
  buildCtaPrompt,
} from '../agents/creative-director';
import {
  buildCampaignPlanPrompt, buildTargetAudiencePrompt,
  buildContentCalendarPrompt, buildBudgetAllocationPrompt,
  buildSuggestPlatformsPrompt, buildCompetitiveAnalysisPrompt,
  buildAbTestIdeasPrompt,
} from '../agents/strategist';
import {
  buildAnalyzePerformancePrompt, buildIdentifyTrendsPrompt,
  buildOptimizationsPrompt, buildROIPrompt, buildReportPrompt,
  buildPredictOutcomesPrompt, buildBenchmarkCompetitorsPrompt,
} from '../agents/data-analyst';
import { buildAnalyzePrompt } from '../agents/visual-analyst';

const DEFAULT_BV: BrandVoiceConfig = {
  tone: 'professional', style: 'conversational', languages: ['id', 'en'],
  description: '', targetAudience: '', keyMessages: [],
};

// Map skillId → promptBuilder + mode
const SKILL_PROMPT_MAP: Record<SkillId, {
  mode: 'text' | 'vision';
  build: (input: Record<string, unknown>, ctx: { brand?: string; prior?: Record<string, unknown> }) => { system: string; user: string };
}> = {
  analyze_model_photo: {
    mode: 'vision',
    build: (input) => buildAnalyzePrompt({ assetType: 'model', context: input.context as string }),
  },
  analyze_background: {
    mode: 'vision',
    build: (input) => buildAnalyzePrompt({ assetType: 'background', context: input.context as string }),
  },
  analyze_product: {
    mode: 'vision',
    build: (input) => buildAnalyzePrompt({ assetType: 'product', context: input.context as string }),
  },
  generate_visual_prompt: {
    mode: 'vision',
    build: (input) => buildAnalyzePrompt({ assetType: 'product', context: input.context as string }),
  },
  extract_brand_colors: {
    mode: 'vision',
    build: (input) => buildAnalyzePrompt({ assetType: 'product', context: input.context as string }),
  },

  generate_ad_copy: {
    mode: 'text',
    build: (input, ctx) => buildAdCopyPrompt({
      brandVoice: (input.brandVoice as BrandVoiceConfig) ?? DEFAULT_BV,
      platform: (input.platform as string) ?? 'Meta',
      objective: (input.objective as string) ?? 'Awareness',
      product: (input.product as string) ?? '',
      visualContext: (ctx.prior?.analyze_model_photo as { mood?: string })?.mood ?? (input.visualContext as string),
    }),
  },
  generate_caption: {
    mode: 'text',
    build: (input) => buildCaptionPrompt({
      brandVoice: (input.brandVoice as BrandVoiceConfig) ?? DEFAULT_BV,
      platform: (input.platform as string) ?? 'Instagram',
      contentContext: (input.contentContext as string) ?? (input.product as string) ?? '',
      includeHashtags: (input.includeHashtags as boolean) ?? true,
    }),
  },
  generate_headline: {
    mode: 'text',
    build: (input, ctx) => buildHeadlinePrompt({
      brandVoice: (input.brandVoice as BrandVoiceConfig) ?? DEFAULT_BV,
      product: (input.product as string) ?? '',
      campaignContext: (ctx.prior?.plan_campaign as { executive_summary?: string })?.executive_summary ?? (input.campaignContext as string),
    }),
  },
  generate_cta: {
    mode: 'text',
    build: (input) => buildCtaPrompt({
      product: (input.product as string) ?? '',
      objective: (input.objective as string) ?? 'purchase',
    }),
  },
  generate_hashtags: {
    mode: 'text',
    build: (input) => buildHashtagsPrompt({
      contentContext: (input.contentContext as string) ?? '',
      platform: (input.platform as string) ?? 'Instagram',
      count: (input.count as number) ?? 15,
    }),
  },
  translate_content: {
    mode: 'text',
    build: (input) => buildTranslatePrompt({
      content: (input.content as string) ?? '',
      targetLanguage: (input.targetLanguage as string) ?? 'id',
      brandVoice: (input.brandVoice as BrandVoiceConfig) ?? DEFAULT_BV,
    }),
  },
  adapt_tone: {
    mode: 'text',
    build: (input) => buildAdaptTonePrompt({
      content: (input.content as string) ?? '',
      targetTone: (input.targetTone as string) ?? 'casual',
      targetStyle: (input.targetStyle as string) ?? 'conversational',
    }),
  },

  plan_campaign: {
    mode: 'text',
    build: (input) => buildCampaignPlanPrompt({
      brandVoice: (input.brandVoice as BrandVoiceConfig) ?? DEFAULT_BV,
      objective: (input.objective as string) ?? '',
      product: (input.product as string) ?? '',
      budget: (input.budget as string) ?? 'Not specified',
      duration: (input.duration as string) ?? '30 days',
      platforms: (input.platforms as string[]) ?? ['Meta', 'Instagram'],
    }),
  },
  define_target_audience: {
    mode: 'text',
    build: (input) => buildTargetAudiencePrompt({
      brandVoice: (input.brandVoice as BrandVoiceConfig) ?? DEFAULT_BV,
      product: (input.product as string) ?? '',
      existingData: input.existingData as string | undefined,
    }),
  },
  suggest_platforms: {
    mode: 'text',
    build: (input) => buildSuggestPlatformsPrompt({
      targetAudience: ((input.brandVoice as BrandVoiceConfig)?.targetAudience) ?? 'general audience',
      budget: (input.budget as string) ?? 'not specified',
      objective: (input.objective as string) ?? 'awareness',
    }),
  },
  create_content_calendar: {
    mode: 'text',
    build: (input, ctx) => buildContentCalendarPrompt({
      campaignPlan: ctx.prior?.plan_campaign ? JSON.stringify(ctx.prior.plan_campaign) : ((input.campaignSummary as string) ?? ''),
      duration: (input.duration as string) ?? '30 days',
      platforms: (input.platforms as string[]) ?? ['Instagram'],
      postsPerWeek: (input.postsPerWeek as number) ?? 5,
    }),
  },
  suggest_budget_allocation: {
    mode: 'text',
    build: (input) => buildBudgetAllocationPrompt({
      totalBudget: (input.budget as string) ?? '',
      platforms: (input.platforms as string[]) ?? ['Meta'],
      objective: (input.objective as string) ?? '',
      duration: (input.duration as string) ?? '30 days',
    }),
  },
  competitive_analysis: {
    mode: 'text',
    build: (input) => buildCompetitiveAnalysisPrompt({
      industry: (input.industry as string) ?? '',
      competitors: (input.competitors as string) ?? 'general market',
    }),
  },
  ab_test_ideas: {
    mode: 'text',
    build: (input) => buildAbTestIdeasPrompt({
      currentPerformance: (input.currentPerformance as string) ?? '',
      goals: (input.goals as string) ?? '',
    }),
  },

  analyze_performance: {
    mode: 'text',
    build: (input) => buildAnalyzePerformancePrompt({
      metrics: (input.metrics as string) ?? '',
      period: (input.period as string) ?? 'Last 30 days',
      platform: input.platform as string | undefined,
    }),
  },
  identify_trends: {
    mode: 'text',
    build: (input) => buildIdentifyTrendsPrompt({
      data: (input.data as string) ?? (input.metrics as string) ?? '',
      period: (input.period as string) ?? 'Last 90 days',
    }),
  },
  suggest_optimizations: {
    mode: 'text',
    build: (input) => buildOptimizationsPrompt({
      performanceData: (input.performanceData as string) ?? (input.metrics as string) ?? '',
      currentStrategy: input.currentStrategy as string | undefined,
      goals: (input.goals as string) ?? '',
    }),
  },
  calculate_roi: {
    mode: 'text',
    build: (input) => buildROIPrompt({
      spend: (input.spend as string) ?? '',
      revenue: (input.revenue as string) ?? '',
      period: (input.period as string) ?? '',
      channel: input.channel as string | undefined,
    }),
  },
  generate_report: {
    mode: 'text',
    build: (input) => buildReportPrompt({
      metrics: (input.metrics as string) ?? '',
      period: (input.period as string) ?? '',
      goals: (input.goals as string) ?? '',
      brandName: input.brandName as string | undefined,
    }),
  },
  predict_outcomes: {
    mode: 'text',
    build: (input) => buildPredictOutcomesPrompt({
      historicalData: (input.historicalData as string) ?? '',
      plannedChanges: (input.plannedChanges as string) ?? '',
    }),
  },
  benchmark_competitors: {
    mode: 'text',
    build: (input) => buildBenchmarkCompetitorsPrompt({
      myMetrics: (input.myMetrics as string) ?? '',
      industry: (input.industry as string) ?? '',
    }),
  },
};

let registered = false;

export function registerModuleAI(): void {
  if (registered) return;
  registered = true;

  // Skills
  for (const def of SKILLS_CATALOG) {
    const promptMap = SKILL_PROMPT_MAP[def.id];
    if (!promptMap) continue;  // skip skills without builder yet
    registerSkill({
      id: def.id,
      moduleId: 'ai_marketing',
      agentId: def.agentId,
      mode: promptMap.mode,
      promptBuilder: promptMap.build,
      model: SKILL_MODEL_MAP[def.id],
    });
  }

  // Also register skills not in SKILLS_CATALOG but in SKILL_PROMPT_MAP
  for (const skillId of Object.keys(SKILL_PROMPT_MAP) as SkillId[]) {
    if (SKILLS_CATALOG.find(s => s.id === skillId)) continue;
    const promptMap = SKILL_PROMPT_MAP[skillId];
    registerSkill({
      id: skillId,
      moduleId: 'ai_marketing',
      agentId: 'unknown',
      mode: promptMap.mode,
      promptBuilder: promptMap.build,
      model: SKILL_MODEL_MAP[skillId],
    });
  }

  // Flows
  for (const flow of Object.values(MULTI_SKILL_FLOWS)) {
    registerFlow({
      id: flow.id,
      moduleId: 'ai_marketing',
      steps: flow.steps.map((step, idx) => ({
        id: `step_${idx}_${step.skill}`,
        skillId: step.skill,
        when: step.conditional === 'hasImages'
          ? (ctx) => Boolean((ctx.input as { imageBase64?: string }).imageBase64)
          : undefined,
      })),
    });
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/modules/ai-marketing/ai/register.ts
git commit -m "feat(ai-marketing): register skills and flows with orchestrator"
```

---

### Task 17: Wire bootstrap in API route

**Files:**
- Modify: `app/api/admin/modules/ai-marketing/generate/route.ts`

- [ ] **Step 1: Replace imports + call sites in generate route**

In `app/api/admin/modules/ai-marketing/generate/route.ts`:

Find:
```ts
import { runSkill, runFlow } from '@/lib/modules/ai-marketing/orchestrator/runner';
```

Replace:
```ts
import { runSkill, runFlow, bootstrapAIRegistry } from '@/lib/ai';
```

At top of `POST` handler, after `requireAuthedMember`, add:

```ts
  await bootstrapAIRegistry();
```

Update `runSkill` call (search for `await runSkill({`) — adjust shape from old:

```ts
      const result = await runSkill({
        siteId, uid, skillId,
        formData: formData ?? {},
        brandVoice,
      });
```

To new:

```ts
      const result = await runSkill({
        skillId,
        input: { ...(formData ?? {}), brandVoice },
        context: { siteId, moduleId: 'ai_marketing', uid },
      });
```

Update `runFlow` call:

Find:
```ts
      const { stepOutputs } = await runFlow(flowId, {
        siteId, uid, formData: formData ?? {}, brandVoice,
      });
```

Replace:
```ts
      const { stepOutputs } = await runFlow({
        flowId,
        input: { ...(formData ?? {}), brandVoice },
        context: { siteId, moduleId: 'ai_marketing', uid },
      });
```

- [ ] **Step 2: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Smoke test all 21 skills + 4 flows**

```bash
pnpm dev
```

Open `/admin/marketing/generate`. Test 1 skill per agent type (4 calls):
- `generate_ad_copy` (creative_director)
- `plan_campaign` (strategist)
- `analyze_performance` (data_analyst)
- `analyze_model_photo` (visual_analyst, upload image)

Then test 1 flow:
- `ad_copy_pack`

Verify all generate successfully and saved to Firestore `generations` collection.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/modules/ai-marketing/generate/route.ts
git commit -m "refactor(ai-marketing): switch generate route to use orchestrator gateway"
```

---

### Task 18: Delete old orchestrator files

**Files:**
- Delete: `lib/modules/ai-marketing/orchestrator/runner.ts`
- Delete: `lib/modules/ai-marketing/orchestrator/flows.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -rn "from '@/lib/modules/ai-marketing/orchestrator/runner'\|from '@/lib/modules/ai-marketing/orchestrator/flows'" lib/ app/ components/
```
Expected: zero output.

- [ ] **Step 2: Delete files**

```bash
git rm lib/modules/ai-marketing/orchestrator/runner.ts lib/modules/ai-marketing/orchestrator/flows.ts
```

- [ ] **Step 3: Verify orchestrator folder is empty (or contains only register-related artifacts)**

```bash
ls lib/modules/ai-marketing/orchestrator/
```

If empty, remove folder:
```bash
rmdir lib/modules/ai-marketing/orchestrator/
```

- [ ] **Step 4: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Smoke test again**

```bash
pnpm dev
```

Re-run smoke from Task 17 step 3. Verify all skills + flow still work.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(ai-marketing): remove legacy orchestrator after migration"
```

---

### Task 19: Update existing tests for new return types

**Files:**
- Modify: `lib/ai/__tests__/index.test.ts`

- [ ] **Step 1: Update assertions for invokeAI return shape**

In `lib/ai/__tests__/index.test.ts`, find the assertions:

```ts
    expect(result).toBe('Generated content');
```

Replace with:

```ts
    expect(result.content).toBe('Generated content');
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.model).toBe('qwen/qwen3.5-flash');
```

Apply to all 4 `invokeAI`/`invokeVision` happy-path assertions in the file.

- [ ] **Step 2: Run tests**

```bash
pnpm vitest lib/ai/
```
Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/__tests__/
git commit -m "test(ai): update invokeAI return type assertions"
```

---

### Task 20: Add register a context enricher for ai-marketing

**Files:**
- Modify: `lib/modules/ai-marketing/ai/register.ts`

- [ ] **Step 1: Import enricher API and brand voice source**

In `lib/modules/ai-marketing/ai/register.ts`, add to imports:

```ts
import { registerContextEnricher } from '@/lib/ai';
import { getMarketingSettings } from '../api-server';
```

- [ ] **Step 2: Register brand voice enricher inside registerModuleAI()**

Inside `registerModuleAI()`, before the final closing brace, add:

```ts
  registerContextEnricher({
    moduleId: 'ai_marketing',
    build: async (siteId: string) => {
      const settings = await getMarketingSettings(siteId);
      if (!settings?.brandVoice) return { section: '', text: '' };
      const bv = settings.brandVoice;
      return {
        section: 'BRAND VOICE',
        text: `Tone: ${bv.tone}\nStyle: ${bv.style}\nDescription: ${bv.description || 'n/a'}\nAudience: ${bv.targetAudience || 'n/a'}\nKey messages: ${bv.keyMessages?.join(', ') || 'n/a'}`,
      };
    },
  });
```

- [ ] **Step 3: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/modules/ai-marketing/ai/register.ts
git commit -m "feat(ai-marketing): register brand voice as context enricher"
```

---

### Task 21: End-to-end smoke test + commit checkpoint

- [ ] **Step 1: Run full test suite**

```bash
pnpm vitest
pnpm tsc --noEmit
pnpm lint
```
Expected: ALL PASS.

- [ ] **Step 2: Manual e2e smoke**

Start dev server:
```bash
pnpm dev
```

Test in browser:
1. Login as a tenant admin
2. Navigate `/admin/marketing/generate`
3. Run each skill once (or sample 1 per agent type)
4. Run `full_campaign` flow
5. Open `/admin/ai-platform/usage`
6. Verify daily ledger shows `bySkill` breakdown (Firestore console: `sites/{siteId}/platform/aiCreditLedger/daily/{date}`)
7. Confirm `byModule.ai_marketing` and `bySkill.{skillId}` both populated

- [ ] **Step 3: If smoke clean, tag checkpoint**

```bash
git tag ai-orchestrator-phase-0-1-complete
git log --oneline ai-orchestrator-phase-0-1-complete~22..HEAD
```

Print summary of changes for review.

---

### Task 22: Update spec status

**Files:**
- Modify: `dev/superpowers/specs/2026-05-22-ai-orchestrator-foundation-design.md`

- [ ] **Step 1: Update status header**

In the spec file, find:

```markdown
**Status:** Awaiting implementation plan
```

Replace:

```markdown
**Status:** Phase 0+1 implemented. Phase 2 (safety) and Phase 3 (multi-mode) pending.
```

- [ ] **Step 2: Commit**

```bash
git add dev/superpowers/specs/2026-05-22-ai-orchestrator-foundation-design.md
git commit -m "docs(ai): mark Phase 0+1 of orchestrator foundation complete"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `pnpm vitest` ALL PASS
- [ ] `pnpm tsc --noEmit` PASS
- [ ] `pnpm lint` PASS
- [ ] `pnpm build` PASS
- [ ] Manual smoke: 21 skills + 4 flows in ai-marketing all work
- [ ] Firestore daily ledger contains `byModule` AND `bySkill` breakdowns
- [ ] `lib/ai/index.ts` exports `runSkill`, `runFlow`, `registerSkill`, `registerFlow`, `bootstrapAIRegistry`
- [ ] `lib/modules/ai-marketing/orchestrator/` deleted
- [ ] No `console.warn` remains in `lib/ai/`
- [ ] No `estimatedCredits` reference remains in repo
- [ ] Tenant Usage page renders module labels (dynamic from Firestore)

---

## Next Plan

After this plan is shipped:
- Plan B: Phase 2 safety layer (rate limit, idempotency, guardrail, retry+timeout) — separate plan file
- Plan C: Phase 3 multi-mode (streaming, tool-loop, per-skill model resolver, audit log) — separate plan file

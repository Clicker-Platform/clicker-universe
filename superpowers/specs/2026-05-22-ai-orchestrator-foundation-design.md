# AI Orchestrator Foundation — Design Spec

**Date:** 2026-05-22
**Status:** Awaiting implementation plan
**Scope:** Phase 0–3. Foundation orchestrator generik untuk semua modul AI (POS, WA, Canvas, Inventory, dst).
**Related specs:**
- `2026-05-12-ai-credit-topup-xendit-design.md` (Phase 6, tidak masuk scope ini)
- `2026-05-13-ai-byod-pos-phase1-design.md` (Phase 5 first consumer, refer untuk POS detail)
- `2026-05-12-ai-core-foundation-design.md` (foundation existing, baseline)

---

## 1. Goal

Bangun **AI Gateway/Orchestrator** di atas foundation `lib/ai/*` existing. Setiap modul (POS, WA, Canvas Studio, Inventory, CRM, Service Records, dll) panggil AI lewat 1 entry point. Modul cuma kenal `skillId` / `flowId` / `agentId` — tidak tahu model, prompt, provider, billing, rate limit.

**3 mode eksekusi:**
1. **Flow** — sequential skill chain (cocok untuk marketing campaign, POS report)
2. **Tool-call** — agent loop dengan function calling (cocok untuk WA chat, NL query)
3. **Stream** — SSE token streaming (cocok untuk chat UX)

**Non-goals:**
- Tidak mengganti billing/pricing/credit ledger (sudah production-ready di `lib/ai/credits.ts`, `pricing.ts`)
- Tidak mengganti provider abstraction (`lib/ai/client.ts` sudah cukup)
- Tidak bikin UI dashboard observability (Phase 4 separate spec)
- Tidak migrate `ai-sales-agent` Gemini-direct path (legacy, biarkan)
- Tidak migrate `stocklens` Gemini Vision (legacy, biarkan)

---

## 2. Background — Foundation Existing

| Komponen | File | Status |
|---|---|---|
| Provider (OpenRouter) | `lib/ai/client.ts` | Production. Text/vision/tools. |
| Credit ledger | `lib/ai/credits.ts` | Atomic tx, daily aggregate, ledger. `byModule` breakdown sudah ada. |
| Pricing | `lib/ai/pricing.ts` | 40+ model fallback + Firestore override. |
| Model registry | `lib/ai/models.ts` | Backyard-managed, `llm` + `vision` slot. |
| Tenant context | `lib/ai/context.ts` | `buildTenantContext(siteId)`. Underused. |
| Gateway entry | `lib/ai/index.ts` | `invokeAI` / `invokeVision` / `invokeWithTools`. |
| Backyard admin | `backyard/app/ai-settings/` | Manual topup USD, ModelRegistry, PricingPanel, UsageLog. |
| Tenant UI | `lib/modules/ai-platform/admin/UsagePage.tsx` | Saldo + breakdown per modul. |
| Test coverage | `lib/ai/__tests__/` | `index.test.ts`, `credits.test.ts`, `pricing.test.ts`, `models.test.ts`. |

**Existing module consumer:**
- `ai-marketing` punya orchestrator sendiri di `lib/modules/ai-marketing/orchestrator/` (flow mode only, hardcoded conditional, inline prompt smell). Akan dimigrate ke foundation orchestrator.

---

## 3. Architecture — C Hybrid

Single namespace root `@/lib/ai`. Sub-folder per concern. Public API stable.

```
lib/ai/
├── index.ts              ← Public facade. Re-export semua. Tambah runSkill/runFlow/runAgent.
├── types.ts              ← Shared types (existing + extension)
├── context.ts            ← Tenant context builder (existing, extend dengan module hook)
├── models.ts             ← Model registry (existing, extend per-skill resolver)
│
├── provider/             ← Provider layer (HTTP, future fallback)
│   ├── client.ts         ← OpenRouter (existing client.ts, MOVE)
│   ├── stream.ts         ← NEW: SSE streaming wrapper
│   └── retry.ts          ← NEW: exponential backoff + timeout
│
├── billing/              ← Billing layer (Firestore tx)
│   ├── credits.ts        ← existing, MOVE. Tambah bySkill aggregate.
│   └── pricing.ts        ← existing, MOVE.
│
├── orchestrator/         ← Orchestration layer (NEW — core dari spec ini)
│   ├── registry.ts       ← Skill/flow/tool/agent registry
│   ├── runner.ts         ← runSkill, runFlow, runAgent, runStream
│   ├── flow.ts           ← Flow execution + context passing
│   ├── tool-loop.ts      ← Agent tool-call loop
│   └── audit.ts          ← Generic call audit log
│
├── safety/               ← Safety layer (NEW)
│   ├── rate-limit.ts     ← Sliding window per siteId+moduleId
│   ├── idempotency.ts    ← Hash-based dedup
│   └── guardrail.ts      ← Daily cap, monthly cap
│
└── __tests__/            ← Tests (existing + new)
```

**Boundary rules:**
- `orchestrator/` boleh import dari `provider/`, `billing/`, `safety/`, `context.ts`, `models.ts`
- `safety/` boleh import dari `billing/` (cek daily total)
- `billing/` TIDAK boleh import dari `orchestrator/` atau `safety/`
- `provider/` standalone (cuma HTTP)
- Modul consumer cuma import `@/lib/ai`

---

## 4. Public API Contract

Single import path untuk semua consumer.

```ts
import {
  // Low-level (existing, backward compat)
  invokeAI, invokeVision, invokeWithTools,

  // Mid-level (existing, backward compat)
  buildTenantContext, getModel,
  deductCredits, addCredits, getCreditBalance,
  calculateCost,

  // High-level (NEW — primary API untuk modul)
  runSkill, runFlow, runAgent, runStream,

  // Registry (saat startup modul)
  registerSkill, registerFlow, registerTool, registerAgent,
  registerContextEnricher,
} from '@/lib/ai';
```

### 4.1 runSkill

```ts
interface RunSkillInput {
  skillId: string;
  input: Record<string, unknown>;
  context: {
    siteId: string;
    moduleId: string;
    uid: string;
    requestId?: string;       // idempotency key, optional
  };
  overrides?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

interface RunSkillOutput {
  content: string;
  structured?: Record<string, unknown>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  durationMs: number;
  cached?: boolean;
}

async function runSkill(input: RunSkillInput): Promise<RunSkillOutput>;
```

### 4.2 runFlow

```ts
interface RunFlowInput {
  flowId: string;
  input: Record<string, unknown>;
  context: { siteId; moduleId; uid; requestId? };
}

interface RunFlowOutput {
  stepOutputs: Record<string, RunSkillOutput>;  // keyed by step.id (NOT skill)
  totalCostUSD: number;
  totalDurationMs: number;
}
```

### 4.3 runAgent (tool-call loop)

```ts
interface RunAgentInput {
  agentId: string;
  messages: ChatMessage[];
  toolIds: string[];           // tool yang available untuk agent ini
  context: { siteId; moduleId; uid; requestId? };
  maxIterations?: number;      // default 5
}

interface RunAgentOutput {
  content: string;
  toolCallsExecuted: { toolId; args; result }[];
  iterations: number;
  totalCostUSD: number;
}
```

### 4.4 runStream

```ts
interface RunStreamInput {
  skillId: string;
  input: Record<string, unknown>;
  context: { siteId; moduleId; uid; requestId? };
}

// AsyncIterable yang yield token chunk
function runStream(input: RunStreamInput): AsyncIterable<{
  type: 'token' | 'done' | 'error';
  content?: string;
  finalUsage?: { inputTokens; outputTokens; costUSD };
}>;
```

### 4.5 Registry API (call saat startup modul)

```ts
interface SkillDef {
  id: string;
  moduleId: string;
  agentId: string;
  mode: 'text' | 'vision' | 'tools';
  promptBuilder: (input, ctx) => { system: string; user: string };
  inputSchema?: ZodSchema;
  outputSchema?: ZodSchema;
  model?: string;              // override default
  maxTokens?: number;
  temperature?: number;
}

interface FlowDef {
  id: string;
  moduleId: string;
  steps: { id: string; skillId: string; when?: Predicate }[];
}

interface ToolDef {
  id: string;
  moduleId: string;
  definition: ToolDefinition;  // existing type
  handler: (args, ctx) => Promise<unknown>;
}

interface AgentDef {
  id: string;
  moduleId: string;
  systemPrompt: string;
  model?: string;
  defaultTools?: string[];
}

interface ContextEnricher {
  moduleId: string;
  build: (siteId: string) => Promise<{ section: string; text: string }>;
}

function registerSkill(def: SkillDef): void;
function registerFlow(def: FlowDef): void;
function registerTool(def: ToolDef): void;
function registerAgent(def: AgentDef): void;
function registerContextEnricher(def: ContextEnricher): void;
```

---

## 5. Phase 0 — Quick Wins

**Tidak ada perubahan arsitektur. 6 item, ~1-2 hari kerja.**

### 5.1 H7 — Tambah `bySkill` aggregate
**File:** `lib/ai/billing/credits.ts` (`deductCredits`)
**Change:** Tambah 2 line di update daily doc:
```ts
[`bySkill.${meta.skillId}.cost`]: FieldValue.increment(costUSD),
[`bySkill.${meta.skillId}.calls`]: FieldValue.increment(1),
```

### 5.2 C4 — Fix token usage fallback
**File:** `lib/ai/provider/client.ts`
**Change:** Hard error kalau `data.usage` missing (sebelumnya `Math.ceil(max_tokens * 0.3)` silent under-charge).
```ts
if (!data.usage?.prompt_tokens || !data.usage?.completion_tokens) {
  logger.error('ai.provider.usage_missing', { model: request.model });
  throw new Error(`usage_missing:${request.model}`);
}
```

### 5.3 M4 — Hapus dead credit-estimator
**Delete:** `lib/modules/ai-marketing/orchestrator/credit-estimator.ts`
**Modify:** `lib/modules/ai-marketing/orchestrator/flows.ts` — hapus field `estimatedCredits`
**Modify:** `lib/modules/ai-marketing/types.ts` — hapus `estimatedCredits` dari `MultiSkillFlow`
**Modify:** UI consumer — verify tidak ada yang baca `estimatedCredits`

### 5.4 M6 — Derive agentId dari catalog
**File:** `app/api/admin/modules/ai-marketing/generate/route.ts`
**Change:** Replace `getAgentForSkill()` dengan lookup di `SKILLS_CATALOG`.

### 5.5 L1 — Replace console.warn dengan logger
**File:** `lib/ai/provider/client.ts` (3 occurrence)
**Change:** `console.warn('[ai/client] usage missing')` → `logger.warn('ai.provider.usage_missing', { model })`

### 5.6 M7 — Module label dari registry
**File:** `lib/modules/ai-platform/admin/UsagePage.tsx`
**Change:** Replace hardcoded `MODULE_LABELS` dengan lookup di `modules` Firestore collection atau client-side registry.

---

## 6. Phase 1 — Orchestrator Core

**~4-5 hari kerja. Core skill/flow runner + registry + context bridge.**

### 6.1 File Layout Pertama

```
lib/ai/orchestrator/
├── index.ts
├── registry.ts
├── runner.ts
├── flow.ts
└── audit.ts
```

**MOVE existing files** ke sub-folder. Update internal imports. `lib/ai/index.ts` re-export semua → consumer tidak break:

```
lib/ai/client.ts        → lib/ai/provider/client.ts
lib/ai/credits.ts       → lib/ai/billing/credits.ts
lib/ai/pricing.ts       → lib/ai/billing/pricing.ts
```

`lib/ai/index.ts` tambah re-export:
```ts
export * from './orchestrator';
export * from './safety';
```

### 6.2 Registry Implementation

In-memory `Map` per registry type. Modul daftarkan saat startup via `lib/modules/{x}/ai/register.ts`. Loaded sekali via root barrel `lib/ai/registry/load.ts` yang dipanggil di Next.js bootstrap.

```ts
// lib/ai/orchestrator/registry.ts
const skills = new Map<string, SkillDef>();
const flows = new Map<string, FlowDef>();
const tools = new Map<string, ToolDef>();
const agents = new Map<string, AgentDef>();
const enrichers = new Map<string, ContextEnricher>();

export function registerSkill(def: SkillDef): void {
  if (skills.has(def.id)) throw new Error(`skill_duplicate:${def.id}`);
  skills.set(def.id, def);
}

export function getSkill(id: string): SkillDef {
  const def = skills.get(id);
  if (!def) throw new Error(`skill_not_found:${id}`);
  return def;
}
// ... idem untuk flow/tool/agent/enricher
```

**Module register convention:**
```
lib/modules/{moduleId}/ai/register.ts   ← Export `registerModuleAI()`
lib/modules/{moduleId}/ai/skills/*.ts   ← Per-skill builder
lib/modules/{moduleId}/ai/agents/*.ts   ← Agent prompt
```

Bootstrap loader `lib/ai/orchestrator/bootstrap.ts`:
```ts
import { registerModuleAI as registerAiMarketing } from '@/lib/modules/ai-marketing/ai/register';
import { registerModuleAI as registerByodPos } from '@/lib/modules/byod_pos/ai/register';
// ... per modul

export function bootstrapAIRegistry() {
  registerAiMarketing();
  registerByodPos();
  // ... idem
}
```

Call `bootstrapAIRegistry()` di Next.js instrumentation hook atau lazy-init di first call.

### 6.3 runSkill Implementation

```ts
// lib/ai/orchestrator/runner.ts
export async function runSkill(req: RunSkillInput): Promise<RunSkillOutput> {
  const t0 = Date.now();
  const skill = getSkill(req.skillId);
  const { siteId, moduleId, uid, requestId } = req.context;

  // 1. Safety preflight (Phase 2 — stub dulu kalau belum jadi)
  await safety.preflight({ siteId, moduleId, skillId: req.skillId, requestId, input: req.input });

  // 2. Build prompt with tenant context + module enrichment
  const { systemPrompt: ctx } = await buildTenantContext(siteId, await collectEnrichment(moduleId, siteId));
  const { system: skillSystem, user } = skill.promptBuilder(req.input, { brand: ctx });
  const system = `${ctx}\n\n${skillSystem}`;

  // 3. Resolve model
  const model = req.overrides?.model
    ?? skill.model
    ?? await getModel(skill.mode === 'vision' ? 'vision' : 'chat');

  // 4. Invoke (existing low-level)
  const result = skill.mode === 'vision'
    ? await invokeVision({ model, messages: [...], max_tokens: skill.maxTokens, temperature: skill.temperature }, { siteId, moduleId, skillId: req.skillId, uid })
    : await invokeAI({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: skill.maxTokens, temperature: skill.temperature }, { siteId, moduleId, skillId: req.skillId, uid });

  // 5. Parse structured
  const structured = tryParseJSON(result);

  // 6. Audit log
  await audit.log({ siteId, moduleId, skillId: req.skillId, uid, model, durationMs: Date.now() - t0, status: 'ok' });

  return { content: result, structured, model, /* ... */ };
}
```

### 6.4 runFlow — Step ID Eksplisit (H4)

Output keyed by `step.id`, bukan `skill`. Mendukung skill duplikat di 1 flow.

```ts
interface FlowStep {
  id: string;                   // unique per step in flow
  skillId: string;
  when?: (ctx: { input; prior: Record<string, unknown> }) => boolean;
  inputMap?: (input, prior) => Record<string, unknown>;  // remap input per step
}
```

### 6.5 Conditional Predicate (H5)

`when` jadi function, bukan string literal. Backward-compat: kalau `when` tidak set → always run.

### 6.6 Context Enrichment Hook (H6)

```ts
// lib/modules/byod_pos/ai/register.ts
import { registerContextEnricher } from '@/lib/ai';

registerContextEnricher({
  moduleId: 'byod_pos',
  build: async (siteId) => {
    const today = await getDailyReport(siteId);
    return {
      section: 'TODAY SALES',
      text: `Revenue: ${today.revenue}\nOrders: ${today.orderCount}\nTop item: ${today.topItem}`,
    };
  },
});
```

`collectEnrichment(moduleId, siteId)` panggil enricher modul aktif → concat ke system prompt.

### 6.7 Migrate ai-marketing ke Orchestrator

| File ai-marketing existing | Action |
|---|---|
| `orchestrator/runner.ts` | Delete (logic pindah ke `lib/ai/orchestrator/runner.ts`) |
| `orchestrator/flows.ts` | Pindah ke `lib/modules/ai-marketing/ai/flows.ts`. Adjust `step.id` |
| `orchestrator/credit-estimator.ts` | Delete (Phase 0) |
| `agents/*.ts` | Stay. Wrap dengan `registerSkill` call |
| `config/model-config.ts` | Pindah ke per-skill `model` field di registerSkill |
| `config/skills-catalog.ts` | Tetap untuk UI form. Sinkronkan id dengan registry |
| `api-server.ts` | Tetap |
| `app/api/admin/modules/ai-marketing/generate/route.ts` | Replace `runSkill/runFlow` import ke `@/lib/ai` |

### 6.8 H3 — Move Inline Prompts to Agent Files

6 skill di-inline di runner ai-marketing existing: `generate_cta`, `suggest_platforms`, `competitive_analysis`, `ab_test_ideas`, `predict_outcomes`, `benchmark_competitors`.

Pindah ke `agents/*.ts` masing-masing, daftarkan via `registerSkill`. Hapus inline switch.

---

## 7. Phase 2 — Safety Layer

**~2-3 hari kerja. Block scaling risk.**

### 7.1 Rate Limiter (C2)

**Pattern:** Sliding window in Firestore.
**Collection:** `sites/{siteId}/platform/aiRateLimit/{moduleId}`
**Doc shape:**
```ts
{
  windowStart: Timestamp,
  count: number,
}
```

**Config:** `platform/config/aiSettings.rateLimits` (Backyard-editable):
```ts
{
  default: { window: 60, max: 30 },         // 30 calls / 60s default
  byModule: {
    byod_pos: { window: 60, max: 60 },
    ai_marketing: { window: 60, max: 20 },
    wa: { window: 60, max: 120 },           // WA chat lebih agresif
  }
}
```

**API:**
```ts
async function checkRateLimit(siteId: string, moduleId: string): Promise<void>;
// Throws 'rate_limited:{retryAfterMs}' kalau exceeded
```

### 7.2 Idempotency (C3)

**Pattern:** Hash input → cache result short-TTL.
**Collection:** `sites/{siteId}/platform/aiIdempotency/{key}` (TTL 5 menit via Firestore TTL policy).
**Key:** `sha256(siteId + skillId + JSON.stringify(input))` truncated 16 char.

**Behavior:**
- Kalau `requestId` di-set di context → pakai itu sebagai key (client-provided, e.g. submit button)
- Kalau tidak → derive dari hash input
- Hit cache → return cached `RunSkillOutput` dengan `cached: true`
- Miss → execute, store result

**API:**
```ts
async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>
): Promise<{ result: T; cached: boolean }>;
```

### 7.3 Spending Guardrail (C1)

**Pattern:** Cap per siteId per day (and optionally per month).
**Storage:** `sites/{siteId}/platform/aiCredits.dailyCap`, `monthlyCap` (optional, default null = no cap).
**Set by:** Backyard superadmin per tenant. Default value di `platform/config/aiSettings.defaultDailyCap` (e.g. $1.00).

**Check:** Sebelum invoke, baca `aiCreditLedger/daily/{date}.totalCost`. Reject kalau `totalCost + estimatedCost > dailyCap`.

**Estimasi cost pre-call:** Pakai `max_tokens * outputRate + 1000 * inputRate` sebagai upper bound conservative. Bukan akurat tapi cukup untuk guardrail.

**Error:** `daily_budget_exceeded:{used}:{cap}`

### 7.4 Safety Preflight Composition

```ts
// lib/ai/safety/index.ts
export async function preflight(params: {
  siteId; moduleId; skillId; requestId?; input;
}): Promise<{ idempotencyKey: string; cachedResult?: unknown }> {
  await checkRateLimit(params.siteId, params.moduleId);
  await checkGuardrail(params.siteId, params.moduleId);
  const key = params.requestId ?? hashInput(params.siteId, params.skillId, params.input);
  const cached = await getIdempotencyCache(params.siteId, key);
  return { idempotencyKey: key, cachedResult: cached };
}
```

`runSkill`/`runFlow`/`runAgent` panggil `preflight` sebelum invoke, panggil `setIdempotencyCache` setelah sukses.

### 7.5 M2 — Retry + Timeout

**File:** `lib/ai/provider/retry.ts`
**Pattern:** 3x exponential backoff (1s, 2s, 4s) untuk status 5xx + network error. Timeout 30s default per call.

```ts
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; timeoutMs?: number }
): Promise<T>;
```

Wrap `callOpenRouter` dengan `withRetry`. Log setiap retry sebagai `ai.provider.retry`.

### 7.6 M3 — Reconciliation Job (deferred)

Pre-deduct pattern terlalu invasive. Pakai reconciliation:
- Scheduled job daily: scan `aiCallAudit` collection (Phase 4) cross-reference dengan `aiCreditLedger.daily`
- Detect drift > $0.01 → alert Backyard

Tidak masuk Phase 2. Catat sebagai Phase 4 task.

---

## 8. Phase 3 — Multi-Mode Support

**~3-4 hari kerja. Streaming + tool-loop + per-skill model resolver.**

### 8.1 Streaming (M1)

**File:** `lib/ai/provider/stream.ts`
**Implementation:** OpenRouter `stream: true` + SSE parsing.

```ts
export async function* callTextStream(
  request: AIRequest
): AsyncIterable<{ type: 'token' | 'done'; content?: string; usage?: TokenUsage }> {
  const res = await fetchSSE({ ...request, stream: true });
  for await (const chunk of parseSSE(res.body)) {
    if (chunk.choices?.[0]?.delta?.content) {
      yield { type: 'token', content: chunk.choices[0].delta.content };
    }
    if (chunk.usage) {
      yield { type: 'done', usage: chunk.usage };
    }
  }
}
```

**Orchestrator wrapper:** `runStream` accumulate token, deduct credit di akhir saat usage event diterima.

**API route pattern:**
```ts
// app/api/.../route.ts (Next.js streaming)
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const stream = runStream({ skillId, input, context });
  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
}
```

### 8.2 Tool-Call Loop (runAgent)

**File:** `lib/ai/orchestrator/tool-loop.ts`

```ts
export async function runAgent(req: RunAgentInput): Promise<RunAgentOutput> {
  const agent = getAgent(req.agentId);
  const tools = req.toolIds.map(id => getTool(id));
  let messages = [{ role: 'system', content: agent.systemPrompt }, ...req.messages];
  const executed: { toolId; args; result }[] = [];
  let totalCostUSD = 0;

  for (let i = 0; i < (req.maxIterations ?? 5); i++) {
    const result = await invokeWithTools(
      { model: agent.model, messages, tools: tools.map(t => t.definition), tool_choice: 'auto' },
      { siteId, moduleId, skillId: `agent:${agent.id}`, uid }
    );
    totalCostUSD += result.costUSD;

    if (result.finishReason === 'stop' || !result.toolCalls.length) {
      return { content: result.content ?? '', toolCallsExecuted: executed, iterations: i + 1, totalCostUSD };
    }

    // Execute tool calls
    messages.push({ role: 'assistant', content: result.content, tool_calls: result.toolCalls });
    for (const call of result.toolCalls) {
      const tool = tools.find(t => t.id === call.function.name);
      if (!tool) throw new Error(`tool_not_found:${call.function.name}`);
      const args = JSON.parse(call.function.arguments);
      const toolResult = await tool.handler(args, req.context);
      executed.push({ toolId: tool.id, args, result: toolResult });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) });
    }
  }
  throw new Error(`max_iterations_exceeded:${req.agentId}`);
}
```

**Safety:** Tool handler harus `await` (no sync side-effect blocking). Audit log per tool call. Tool dispatch dalam transaction Firestore kalau handler write DB (delegated ke handler).

### 8.3 Per-Skill Model Resolver (H2)

Extend `lib/ai/models.ts`:

```ts
interface ModelConfigExtended {
  default: { llm: string; vision: string };
  perSkill: Record<string, string>;       // skillId → model
  perModule: Record<string, { llm: string; vision: string }>;
}

export async function resolveModel(opts: {
  skillId?: string;
  moduleId?: string;
  useCase: 'llm' | 'vision';
}): Promise<string> {
  const config = await getModelConfig();
  if (opts.skillId && config.perSkill[opts.skillId]) return config.perSkill[opts.skillId];
  if (opts.moduleId && config.perModule[opts.moduleId]) return config.perModule[opts.moduleId][opts.useCase];
  return config.default[opts.useCase];
}
```

Backyard UI: ModelRegistry tambah tab "Per-Skill Override" dan "Per-Module Override". CRUD Firestore `modules/ai-platform/config/models`.

### 8.4 Audit Log Generic (M5 — partial)

**File:** `lib/ai/orchestrator/audit.ts`
**Collection:** `sites/{siteId}/aiCalls/{auto-id}`
**Doc shape:**
```ts
{
  moduleId: string;
  skillId: string;
  flowId?: string;
  agentId?: string;
  mode: 'skill' | 'flow' | 'agent' | 'stream';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  durationMs: number;
  status: 'ok' | 'error' | 'cached' | 'rate_limited' | 'guardrail_blocked';
  errorCode?: string;
  uid: string;
  createdAt: Timestamp;
}
```

**Opt-in retention:** `platform/config/aiSettings.auditRetentionDays` (default 30, Firestore TTL policy).

Phase 4 dashboard UI baca dari sini.

---

## 9. Migration Path — `ai-marketing`

**Goal:** Existing ai-marketing tetap jalan during migration, swap behind facade.

### Step-by-step

1. **Phase 0** quick wins applied → ai-marketing tetap pakai orchestrator existing
2. **Phase 1.1** — move `lib/ai/client.ts` → `provider/client.ts`. Re-export di `lib/ai/index.ts`. Existing consumer no break.
3. **Phase 1.2** — bangun orchestrator core di `lib/ai/orchestrator/`. New code, no consumer yet.
4. **Phase 1.3** — bikin `lib/modules/ai-marketing/ai/register.ts`. Daftarkan semua 21 skill via `registerSkill` (port dari `SKILLS_CATALOG` + agent files + `SKILL_MODEL_MAP`).
5. **Phase 1.4** — bikin `lib/modules/ai-marketing/ai/flows.ts` (port dari `orchestrator/flows.ts` + tambah `step.id`).
6. **Phase 1.5** — modify `app/api/admin/modules/ai-marketing/generate/route.ts`:
   - Replace `import { runSkill, runFlow } from '@/lib/modules/ai-marketing/orchestrator/runner'`
   - Dengan `import { runSkill, runFlow } from '@/lib/ai'`
7. **Phase 1.6** — delete `lib/modules/ai-marketing/orchestrator/runner.ts`, `flows.ts`, `credit-estimator.ts`
8. **Test:** existing ai-marketing UI smoke test all 21 skills + 4 flows

**Rollback:** Step 5-6 reversible via git. Step 2-3 cuma move + re-export, zero behavior change.

---

## 10. Module Self-Registration Convention

Setiap modul AI-consuming punya struktur:

```
lib/modules/{moduleId}/ai/
├── register.ts          ← Export `registerModuleAI()` — bootstrap entry
├── skills/              ← Per-skill prompt builder
│   ├── insight.ts
│   └── forecast.ts
├── agents/              ← Per-agent system prompt
│   └── cashier.ts
├── tools/               ← Tool handler (untuk runAgent)
│   ├── get-stock.ts
│   └── place-order.ts
├── flows/               ← Multi-skill flows
│   └── weekly-restock.ts
└── enrichment.ts        ← Context enricher
```

Pattern di `register.ts`:
```ts
import { registerSkill, registerFlow, registerTool, registerAgent, registerContextEnricher } from '@/lib/ai';
import { buildDailyInsightPrompt } from './skills/insight';
// ... imports

export function registerModuleAI() {
  registerSkill({
    id: 'pos_daily_insight',
    moduleId: 'byod_pos',
    agentId: 'pos_analyst',
    mode: 'text',
    promptBuilder: buildDailyInsightPrompt,
    model: 'openai/gpt-4o-mini',
    maxTokens: 1024,
  });
  // ... idem skills, flows, tools, agents

  registerContextEnricher({ moduleId: 'byod_pos', build: enrichPosContext });
}
```

Bootstrap di `lib/ai/orchestrator/bootstrap.ts` daftarkan semua modul.

---

## 11. File Map — New Files

```
lib/ai/orchestrator/
  index.ts                ← NEW
  registry.ts             ← NEW
  runner.ts               ← NEW
  flow.ts                 ← NEW
  tool-loop.ts            ← NEW (Phase 3)
  audit.ts                ← NEW
  bootstrap.ts            ← NEW

lib/ai/safety/
  index.ts                ← NEW
  rate-limit.ts           ← NEW
  idempotency.ts          ← NEW
  guardrail.ts            ← NEW

lib/ai/provider/
  client.ts               ← MOVE dari lib/ai/client.ts
  stream.ts               ← NEW (Phase 3)
  retry.ts                ← NEW (Phase 2)

lib/ai/billing/
  credits.ts              ← MOVE dari lib/ai/credits.ts. Tambah bySkill.
  pricing.ts              ← MOVE dari lib/ai/pricing.ts

lib/modules/ai-marketing/ai/
  register.ts             ← NEW
  flows.ts                ← MOVE (dari orchestrator/flows.ts)

lib/ai/__tests__/
  orchestrator.test.ts    ← NEW
  safety.test.ts          ← NEW
  registry.test.ts        ← NEW
```

## 12. File Map — Modified Files

```
lib/ai/index.ts           ← Re-export semua sub-folder + facade
lib/ai/context.ts         ← Tambah collectEnrichment() — concat module enrichers
lib/ai/models.ts          ← Phase 3: resolveModel() per-skill/per-module
lib/ai/billing/credits.ts ← Phase 0: bySkill aggregate

lib/modules/ai-marketing/agents/creative-director.ts  ← Phase 0: add 6 inline-moved prompt builders
lib/modules/ai-marketing/agents/strategist.ts          ← Idem
lib/modules/ai-marketing/agents/data-analyst.ts        ← Idem
app/api/admin/modules/ai-marketing/generate/route.ts   ← Phase 1.5: import dari @/lib/ai
lib/modules/ai-marketing/config/skills-catalog.ts      ← Sinkronkan id dengan registry

lib/modules/ai-platform/admin/UsagePage.tsx            ← Phase 0: module labels dari registry
backyard/app/ai-settings/_components/ModelRegistry.tsx ← Phase 3: per-skill/per-module override UI
platform/config/aiSettings (Firestore)                  ← Tambah rateLimits, defaultDailyCap, auditRetentionDays
```

## 13. File Map — Deleted Files

```
lib/modules/ai-marketing/orchestrator/runner.ts           ← Phase 1.6
lib/modules/ai-marketing/orchestrator/flows.ts            ← Phase 1.6 (moved)
lib/modules/ai-marketing/orchestrator/credit-estimator.ts ← Phase 0
lib/modules/ai-marketing/config/model-config.ts           ← Phase 1 (pindah ke perSkill di Firestore)
```

---

## 14. Firestore Schema Changes

### 14.1 `sites/{siteId}/platform/aiCredits` (modify)
```ts
{
  balance: number,
  lifetimeUsed: number,
  dailyCap?: number,        // NEW (Phase 2) — null = no cap
  monthlyCap?: number,      // NEW (Phase 2)
}
```

### 14.2 `sites/{siteId}/platform/aiCreditLedger/daily/{date}` (modify)
```ts
{
  date: string,
  totalCost: number,
  callCount: number,
  inputTokens: number,
  outputTokens: number,
  byModule: Record<string, { cost; calls }>,
  bySkill: Record<string, { cost; calls }>,    // NEW (Phase 0)
}
```

### 14.3 `sites/{siteId}/platform/aiRateLimit/{moduleId}` (NEW)
```ts
{
  windowStart: Timestamp,
  count: number,
}
```

### 14.4 `sites/{siteId}/platform/aiIdempotency/{key}` (NEW)
TTL 5 min.
```ts
{
  result: RunSkillOutput,
  createdAt: Timestamp,
}
```

### 14.5 `sites/{siteId}/aiCalls/{id}` (NEW — Phase 3)
Audit log. TTL via `platform/config/aiSettings.auditRetentionDays`.

### 14.6 `platform/config/aiSettings` (modify)
```ts
{
  marginMultiplier: 1.2,        // existing (topup spec)
  rateLimits: {                  // NEW
    default: { window: 60, max: 30 },
    byModule: Record<string, { window; max }>,
  },
  defaultDailyCap: 1.0,          // NEW — USD
  auditRetentionDays: 30,        // NEW
}
```

### 14.7 `modules/ai-platform/config/models` (modify Phase 3)
```ts
{
  llm: string,                   // existing → renamed default.llm
  vision: string,                // existing → renamed default.vision
  default: { llm; vision },      // NEW
  perSkill: Record<string, string>,    // NEW
  perModule: Record<string, { llm; vision }>, // NEW
}
```

Migration: backfill `default.llm = llm`, `default.vision = vision`.

---

## 15. Error Codes

Standard prefix pattern (existing `insufficient_credits:` style).

| Code | Source | Meaning |
|---|---|---|
| `insufficient_credits:{balance}:{required}` | billing | (existing) Saldo kurang |
| `model_not_priced:{model}` | billing | (existing) Pricing tidak ada |
| `model_config_not_set` | models | (existing) Backyard belum set model |
| `usage_missing:{model}` | provider | NEW — Token usage absent dari response |
| `rate_limited:{retryAfterMs}` | safety | NEW — Rate limit hit |
| `daily_budget_exceeded:{used}:{cap}` | safety | NEW — Guardrail block |
| `skill_not_found:{id}` | registry | NEW |
| `flow_not_found:{id}` | registry | NEW |
| `tool_not_found:{id}` | registry | NEW |
| `skill_duplicate:{id}` | registry | NEW — Bootstrap collision |
| `max_iterations_exceeded:{agentId}` | tool-loop | NEW — runAgent loop runaway |

All errors → structured log `ai.{layer}.{event}`.

---

## 16. Testing Strategy

| Test | Type | Coverage |
|---|---|---|
| `orchestrator.test.ts` | Unit | runSkill basic, runFlow step.id, conditional predicate, context enrichment |
| `registry.test.ts` | Unit | register duplicate, get not found, multi-modul registration |
| `safety.test.ts` | Unit | rate limit sliding window, idempotency hit/miss, guardrail cap |
| `provider/retry.test.ts` | Unit | exponential backoff, timeout, 5xx vs 4xx handling |
| `billing/credits.test.ts` | Unit | (existing) + bySkill aggregate assertion |
| `e2e/ai-marketing.test.ts` | Integration | full skill via gateway, full flow, model resolution |

Maintain existing test coverage `lib/ai/__tests__/*` — pastikan tetap pass setelah file move.

---

## 17. Out of Scope (Phase 4+)

| Item | Phase | Spec |
|---|---|---|
| Observability dashboard (per-skill chart, per-model chart) | 4 | NEW spec |
| OpenRouter pricing auto-sync job | 4 | NEW spec (H1) |
| Reconciliation job (M3) | 4 | NEW spec |
| POS Phase 1 implementation (8 fitur) | 5 | `2026-05-13-ai-byod-pos-phase1-design.md` |
| Xendit self-serve topup | 6 | `2026-05-12-ai-credit-topup-xendit-design.md` |
| WA module AI integration | 7 | TBD |
| Canvas Studio AI block generation | 7 | TBD |
| Inventory AI alert | 7 | TBD |
| CRM AI lead scoring | 7 | TBD |
| Service Records AI reminder | 7 | TBD |
| Dynamic skill from Firestore (Backyard CRUD) | 7+ | NEW spec |
| Multi-provider fallback (Anthropic direct, OpenAI direct) | 8+ | NEW spec |

---

## 18. Effort Estimate

| Phase | Items | Days |
|---|---|---|
| 0 — Quick wins | bySkill, token fix, dead code, logger, module labels | 1-2 |
| 1 — Orchestrator core | Folder layout, registry, runner, context bridge, migrate ai-marketing | 4-5 |
| 2 — Safety | Rate limit, idempotency, guardrail, retry+timeout | 2-3 |
| 3 — Multi-mode | Streaming, runAgent, per-skill model resolver, audit log | 3-4 |
| **Total Foundation** | | **10-14 hari** |

---

## 19. Open Questions

1. **Bootstrap timing** — di Next.js, kapan `bootstrapAIRegistry()` dipanggil? Instrumentation hook (`instrumentation.ts`) atau lazy init di first call? Lazy lebih simple, instrumentation lebih predictable.
2. **Stream API consumer pattern** — Next.js `ReadableStream` SSE atau `useSWR` polling? SSE lebih efisien tapi error handling lebih kompleks di client.
3. **Idempotency key collision** — kalau 2 user di siteId sama submit identik dalam 5 menit, hit cache yang sama (mungkin bug atau fitur). Tambah `uid` ke hash key untuk avoid?
4. **Rate limit storage** — Firestore vs in-memory (per Next.js instance). Multi-instance deploy butuh Firestore atau Redis. Pilih Firestore untuk konsistensi (sudah punya infra), tradeoff latency.
5. **Audit log retention** — TTL Firestore atau scheduled cleanup? TTL lebih simple tapi extra cost write.

---

## 20. Success Criteria

- ✅ Modul AI baru cuma butuh `lib/modules/{x}/ai/register.ts` + skill builder + (optional) tool handler. No core change.
- ✅ Existing ai-marketing tetap fungsional setelah migration (all 21 skill + 4 flow smoke pass)
- ✅ POS Phase 1 (8 fitur) bisa di-implement tanpa modify orchestrator core
- ✅ Cost per skill terlihat di Backyard + tenant Usage page
- ✅ Tenant tidak bisa burn > dailyCap dalam 1 hari
- ✅ Double-click submit tidak menghasilkan double-charge
- ✅ Test coverage `lib/ai/orchestrator/` + `lib/ai/safety/` ≥ 80%
- ✅ Zero breaking change untuk modul consumer existing (backward-compat via `lib/ai/index.ts` facade)

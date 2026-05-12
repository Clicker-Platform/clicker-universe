# AI Core Foundation — Design Spec
**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Consolidate all AI providers into 1 OpenRouter-based core layer

---

## Vision

AI adalah **core platform** — bukan modul opsional. Setiap tenant dan modul memiliki akses AI. Spec ini membangun **fondasi infrastruktur** yang benar sebagai landasan untuk intelligence layer di masa depan (analisa laporan, prediksi stok, otomatisasi promo).

---

## Current State (Before)

| Module | Provider | File |
|--------|----------|------|
| AI Marketing | OpenRouter ✅ | `lib/ai/openrouter-client.ts` |
| AI Sales Agent | Gemini SDK ❌ | `lib/modules/ai-sales-agent/server/gemini-client.ts` |
| Stocklens | Gemini SDK ❌ | `lib/modules/stocklens/server/gemini-scanner.ts` |
| Knowledge Sync | Gemini SDK ❌ | `app/api/admin/knowledge/sync/route.ts` (inline) |

**Problem:** 2 providers, scattered clients, no unified context, per-module API key management.

---

## Target State (After)

- **0 imports** of `@google/generative-ai` anywhere in codebase
- **1 AI Core** at `lib/ai/` — single entry point for all modules
- **1 API key** via GCP Secret Manager
- **Per-tenant credit consumption** — all modules tracked
- **Foundation** for tenant business context injection

---

## Architecture

### Directory Structure

```
lib/ai/
├── index.ts        ← public API (only import point for all modules)
├── client.ts       ← OpenRouter HTTP client
├── types.ts        ← all shared types
├── credits.ts      ← per-tenant credit deduction/refund/check
├── models.ts       ← fetch model config from Firestore, cached TTL 5min
└── context.ts      ← buildTenantContext(siteId) — foundation for intelligence layer
```

### Public API (`index.ts`)

```ts
// Text generation
export async function invokeAI(
  request: AIRequest,
  options: AICallOptions
): Promise<string>

// Image + text (vision)
export async function invokeVision(
  request: VisionRequest,
  options: AICallOptions
): Promise<string>

// Structured tool calling (OpenAI format)
export async function invokeWithTools(
  request: ToolRequest,
  options: AICallOptions
): Promise<ToolResponse>

// Tenant business context builder
export async function buildTenantContext(
  siteId: string,
  enrichment?: ContextEnrichment
): Promise<TenantContext>
```

All calls require `siteId` in `AICallOptions` — enables per-tenant credit tracking.

---

## API Key Management

**Storage:** GCP Secret Manager  
**Secret name:** `OPENROUTER_API_KEY`  
**Access:** Firebase Admin service account + `Secret Manager Secret Accessor` role  
**Caching:** In-memory, TTL 10 minutes (avoid per-call Secret Manager fetch)

```ts
// client.ts — key fetch with cache
let cachedKey: { value: string; expiresAt: number } | null = null;

async function getApiKey(): Promise<string> {
  if (cachedKey && Date.now() < cachedKey.expiresAt) return cachedKey.value;
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/OPENROUTER_API_KEY/versions/latest`,
  });
  const value = version.payload?.data?.toString() ?? '';
  cachedKey = { value, expiresAt: Date.now() + 10 * 60 * 1000 };
  return value;
}
```

**Setup required (one-time):**
1. Create secret `OPENROUTER_API_KEY` in GCP Secret Manager
2. Grant `Secret Manager Secret Accessor` role to existing Firebase service account
3. Add `@google-cloud/secret-manager` package

---

## Model Registry

**Storage:** Firestore `modules/ai-platform/config/models`  
**Managed by:** Backyard → AI Platform Settings screen  
**Caching:** In-memory, TTL 5 minutes

```ts
// Firestore document structure
{
  chat:    'google/gemini-2.0-flash',
  vision:  'google/gemini-2.0-flash',
  tools:   'google/gemini-2.0-flash',
  fast:    'google/gemini-2.0-flash-lite',
  quality: 'anthropic/claude-sonnet-4',
}

// Fallback (if Firestore not configured)
const FALLBACK_MODELS = {
  chat:    'google/gemini-2.0-flash',
  vision:  'google/gemini-2.0-flash',
  tools:   'google/gemini-2.0-flash',
  fast:    'google/gemini-2.0-flash-lite',
  quality: 'anthropic/claude-sonnet-4',
}
```

Modules declare which use-case they need (`chat`, `vision`, `tools`, `fast`, `quality`) — AI Core resolves the actual model. Modules never hardcode model strings.

---

## Credit System

**No change to existing logic** — refactor clean into `credits.ts`.

**Firestore path:** `sites/{siteId}/platform/aiCredits`  
**Ledger path:** `sites/{siteId}/platform/aiCredits/ledger/{entryId}`

Flow per AI call:
1. Deduct credits atomically (throws `insufficient_credits` if balance < cost)
2. Call OpenRouter
3. Success → return response
4. Failure → refund credits automatically

**Top-up scope:** deferred — will be handled in Backyard tenant management screen (future task).

---

## Tenant Business Context (`context.ts`)

Foundation layer — not yet used for intelligence, but establishes the pattern.

```ts
// Firestore: sites/{siteId}/ai/context (auto-populated, updated by modules)
interface TenantBusinessContext {
  businessName: string
  businessType: string       // F&B, retail, automotive, etc.
  tone: string              // formal, casual, friendly
  language: string          // id, en
  knowledgeBase: string     // from knowledge sync module
  activeModules: string[]   // enabled modules for this tenant
}

interface ContextEnrichment {
  products?: Product[]       // injected by inventory/menu module
  recentTransactions?: any[] // injected by POS/reservation module
  custom?: string            // free-form context from calling module
}

async function buildTenantContext(
  siteId: string,
  enrichment?: ContextEnrichment
): Promise<TenantContext>
```

Modules that call `invokeAI` can optionally pass enrichment. AI Core merges base context + enrichment into system prompt automatically.

---

## Module Migration Plan

### 1. AI Sales Agent
**From:** `gemini-client.ts` (Gemini SDK, native function calling)  
**To:** `invokeWithTools` (OpenRouter, OpenAI tool_call format)

Tools migrated:
- `save_lead` — save customer contact to Firestore
- `lookup_knowledge` — search knowledge base content

API key: removed per-site key UI → platform key only  
Model: `tools` use-case from model registry  
`listAvailableModels` → removed (was Gemini-specific)

### 2. Stocklens
**From:** `gemini-scanner.ts` (Gemini SDK + Google Search grounding)  
**To:** `invokeVision` (OpenRouter vision)

Google Search grounding: **removed temporarily** — model uses training data for pricing  
Fallback model chain: retained (try multiple models on quota errors)  
API key: removed per-site key UI → platform key only  
Model: `vision` use-case from model registry

### 3. Knowledge Sync (PDF Extraction)
**From:** inline `getGeminiClient` import in `knowledge/sync/route.ts`  
**To:** `invokeVision` 

No structural change to route — only swap AI client call.

### 4. AI Marketing
**No changes** — already on OpenRouter via `openrouter-client.ts`.  
Future: migrate to use `lib/ai/index.ts` public API (separate task).

---

## Backyard: AI Platform Settings Screen

New screen in Backyard for superadmin:

- **OpenRouter Status** — verify key is configured in GCP Secret Manager (ping test)
- **Default Models** — edit model per use-case (chat/vision/tools/fast/quality), saved to Firestore
- **Usage Overview** — total credits consumed across all tenants (aggregate view)

Credit top-up per tenant: in Backyard → Tenant Detail (future task, out of scope).

---

## Out of Scope (Future Tasks)

- Intelligence layer (report analysis, stock prediction, promo automation)
- Per-tenant self-serve credit top-up / billing
- Per-tenant model override UI
- Google Search grounding for Stocklens (needs alternative: Serper API or custom search)
- AI Marketing migration to new `lib/ai/index.ts` API
- Streaming responses

---

## Dependencies

| Package | Action |
|---------|--------|
| `@google/generative-ai` | **Remove** after migration complete |
| `@google-cloud/secret-manager` | **Add** |

---

## Success Criteria

- [ ] `grep -r "@google/generative-ai"` returns 0 results in `lib/` and `app/`
- [ ] All AI calls go through `lib/ai/index.ts`
- [ ] Per-tenant credits deducted correctly for AI Sales Agent and Stocklens calls
- [ ] Backyard AI Platform Settings screen functional
- [ ] Existing AI Marketing continues working without changes

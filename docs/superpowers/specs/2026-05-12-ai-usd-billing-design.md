# AI USD Billing & Usage Transparency Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace integer credit system with USD-based billing using actual token usage per model, with full usage transparency for tenants.

**Architecture:** OpenRouter returns token usage in every response. Cost is calculated server-side using a per-model price table managed by Backyard. Tenant balance is stored as USD float. Every AI call writes a ledger entry with model, tokens, and cost.

**Tech Stack:** Firestore (balance + ledger + pricing), Next.js API routes, React client components.

---

## 1. Firestore Schema

### `sites/{siteId}/platform/aiCredits`
```
balance: number        // USD float, e.g. 4.9823
lifetimeUsed: number   // USD float total spent all time
```

### `sites/{siteId}/platform/aiCreditLedger/entries/{id}`
```
type: 'topup' | 'debit' | 'refund'
amount: number         // USD float — negative for debit, positive for topup/refund
balanceAfter: number   // USD float snapshot after this entry
moduleId: string       // e.g. 'ai_sales_agent'
skillId: string        // e.g. 'chat'
model: string          // e.g. 'google/gemini-2.0-flash'  (debit only)
inputTokens: number    // prompt tokens  (debit only)
outputTokens: number   // completion tokens  (debit only)
costUSD: number        // absolute cost, same as |amount|  (debit only)
performedBy: string    // uid or 'system'
createdAt: Timestamp
```

### `modules/ai-platform/config/pricing`
```
models: Record<string, { inputPer1M: number; outputPer1M: number }>
// e.g. { 'google/gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 } }
updatedAt: Timestamp
```
- Managed exclusively by Backyard superadmin.
- Cached in-process for 5 minutes.
- **No fallback** — if a model has no pricing entry, the call is rejected with error `model_not_priced`.

---

## 2. `lib/ai/` Layer Changes

### New file: `lib/ai/pricing.ts`
- `getPricingTable(): Promise<Record<string, { inputPer1M: number; outputPer1M: number }>>` — fetch from Firestore, cache 5 min.
- `calculateCost(model, inputTokens, outputTokens): Promise<number>` — returns USD float. Throws `model_not_priced:{model}` if model missing from table.
- `invalidatePricingCache(): void`

### Updated: `lib/ai/client.ts`
All three functions return token usage alongside content:
```typescript
interface AIResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

interface AIToolResult {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
  inputTokens: number;
  outputTokens: number;
  model: string;
}

callText(request: AIRequest): Promise<AIResult>
callVision(request: VisionRequest): Promise<AIResult>
callWithTools(request: ToolRequest): Promise<AIToolResult>
```
Extract from OpenRouter response: `data.usage.prompt_tokens`, `data.usage.completion_tokens`.

**Token usage fallback (missing usage field):**
```typescript
const inputTokens = data.usage?.prompt_tokens ?? Math.ceil((request.max_tokens ?? 2048) * 0.3);
const outputTokens = data.usage?.completion_tokens ?? (request.max_tokens ?? 2048);
// If fallback used: log warning with model + skillId for investigation
```
Upper-bound estimate prevents platform absorbing cost silently when OpenRouter omits usage.

### Updated: `lib/ai/types.ts`
```typescript
// Remove creditCost field
interface AICallOptions {
  siteId: string;
  moduleId: string;
  skillId: string;
  uid: string;
  // creditCost REMOVED — cost calculated from token usage
}

// Add to CreditBalance
interface CreditBalance {
  balance: number;      // USD float
  lifetimeUsed: number; // USD float
}

// Add internal result type
interface AIUsageResult {
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  model: string;
}
```

### Updated: `lib/ai/credits.ts`
```typescript
// New signature
deductCredits(
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
): Promise<{ balanceAfter: number }>

// insufficient check: balance < costUSD → throw `insufficient_credits:{balance}:{costUSD}`
// ledger entry includes model, inputTokens, outputTokens, costUSD

refundCredits(
  siteId: string,
  costUSD: number,
  meta: { moduleId: string; skillId: string; reason: string; model: string }
): Promise<void>

// initTenantCredits: REMOVE this function entirely.
// Tenant starts with balance = 0. Backyard uses existing POST /api/ai-settings/credits
// to top-up when activating a tenant. No separate init needed.
```

### Updated: `lib/ai/index.ts`
New `withCredits` flow — deduct AFTER AI call (cost unknown until response):
```
1. Call AI fn() → { content, inputTokens, outputTokens, model }
2. calculateCost(model, inputTokens, outputTokens) → costUSD
3. deductCredits(siteId, costUSD, { model, inputTokens, outputTokens, ... })
   - Pre-flight gate (BEFORE calling AI):
     - balance <= 0 → reject immediately, throw `insufficient_credits`, no AI call made
     - balance > 0 → proceed (even if balance < estimated cost — cost per call tiny, platform absorbs rare shortfall)
   - If deductCredits fails insufficient after AI call → log warning, do not re-throw (call already succeeded, tiny loss acceptable)
   - This eliminates the "AI called but not charged" edge case for zero-balance tenants entirely.
4. Return content to caller
5. If AI call throws → no deduction (nothing to refund)
6. If deductCredits throws for reasons other than insufficient → log + do not block caller (best-effort billing)
```

Remove `creditCost` from all `invokeAI`, `invokeVision`, `invokeWithTools` call sites (~10 locations).

---

## 3. Backyard Changes

### Pricing Panel — new tab in `/ai-settings`
- Table: Model ID | Input $/1M | Output $/1M | Actions
- Inline edit per row
- Add row: input model ID + input rate + output rate
- Delete row (with confirmation)
- Save writes to `modules/ai-platform/config/pricing`
- API: `GET /api/ai-settings/pricing` + `POST /api/ai-settings/pricing`

### Credits Panel — update existing
- Top-up amount: USD float input (was integer)
- Welcome bonus: removed from code, superadmin enters amount manually at tenant activation
- Backyard `POST /api/ai-settings/credits` body: `{ siteId, amount: number (USD), reason? }`

### Usage Log — update existing
- Add columns: `model`, `inputTokens`, `outputTokens`, `costUSD`
- Filter by moduleId

---

## 4. Tenant Usage Page

### Route: `app/admin/(dashboard)/ai-usage/page.tsx`
Added to AdminSidebar under Settings group.

### API: `GET /api/admin/ai-usage`
- Headers: `x-site-id`
- Query: `?limit=20&cursor={createdAt}&moduleId={optional}`
- Returns: `{ entries: LedgerEntry[], nextCursor: string | null }`
- Only returns `type: 'debit'` entries
- Ordered `createdAt desc`

### UI Components
**`lib/modules/ai-platform/admin/UsagePage.tsx`**

Summary cards (top):
- **Balance** — current USD balance (green/amber/red based on amount)
- **This month** — sum of debit entries current calendar month
- **All time** — `lifetimeUsed`

Usage table:
| Column | Value |
|--------|-------|
| Time | Relative ("2 jam lalu") + full datetime on hover |
| Feature | humanized moduleId/skillId (e.g. "AI Chat", "Scan Produk", "Buat Konten") |
| Model | Short name (e.g. "Gemini Flash", "Claude Sonnet") |
| Tokens | `{inputTokens} in / {outputTokens} out` |
| Cost | `$0.0002` (4 decimal places) |

- Filter dropdown by module
- Pagination: "Load more" button (cursor-based)
- Empty state: "Belum ada penggunaan AI"

### `AICreditBanner.tsx` — update thresholds
- warn: balance < $0.50
- critical: balance < $0.10
- out: balance <= 0

---

## 5. Skill-to-Feature Label Map
Hardcoded in client for humanizing ledger entries:
```typescript
const SKILL_LABELS: Record<string, string> = {
  'ai_sales_agent/chat': 'AI Chat',
  'ai_sales_agent/chat_followup': 'AI Chat',
  'ai_sales_agent/pdf_extraction': 'Knowledge Sync (PDF)',
  'stocklens/scan_product': 'Scan Produk',
  'ai_marketing/generate_ad_copy': 'Buat Iklan',
  'ai_marketing/plan_campaign': 'Rencana Kampanye',
  'ai_marketing/analyze_model_photo': 'Analisis Foto',
  // ... dst
}
```

---

## 6. Migration

1. Reset all tenant balances to 0 (only 1 active site — manual top-up after deploy)
2. Existing ledger entries left as-is (historical, no backfill needed)
3. `DEFAULT_FREE_CREDITS` constant removed
4. All `creditCost` fields removed from callers

---

## 7. Error Handling

| Error | Cause | Response |
|-------|-------|----------|
| `insufficient_credits:{bal}:{cost}` | balance < costUSD | HTTP 402, user-friendly message |
| `model_not_priced:{model}` | model missing from pricing table | HTTP 500, log to server, tenant sees generic error |
| OpenRouter token usage missing | OR bug / free model | Estimate cost: `calculateCost(model, max_tokens * 0.3, max_tokens)` as upper-bound fallback. Log warning with model + request context. |

For `model_not_priced`: do not expose model name to tenant. Log server-side, show generic "AI tidak tersedia saat ini".

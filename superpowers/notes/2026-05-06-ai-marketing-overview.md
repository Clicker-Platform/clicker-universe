# AI Marketing Module — Overview

Date: 2026-05-06
Audience: Dev team onboarding / reference

This note explains the platform-level AI credit system and the `ai_marketing` module that consumes it.

---

## 1. Platform AI Credit System

File: [clicker-platform-v2/lib/ai/credits.ts](../../clicker-platform-v2/lib/ai/credits.ts)

Server-only (`firebase-admin`), shared across **all** AI modules. Every AI call across the platform debits this single ledger.

### Firestore layout

- Balance doc: `sites/{siteId}/platform/aiCredits` → `{ balance, lifetimeUsed }`
- Ledger (append-only audit trail): `sites/{siteId}/platform/aiCreditLedger` → entries with `type`, `amount`, `balanceAfter`, `moduleId`, `skillId`, `description`, `performedBy`, `createdAt`

### Exported functions

| Function | Purpose | Atomic? |
|---|---|---|
| `deductCredits(siteId, cost, meta)` | Debit before AI call. Throws `insufficient_credits:{balance}:{required}` if low | Transaction |
| `refundCredits(siteId, cost, meta)` | Add back after a failed AI call | Batch (additive-only is safe without a tx) |
| `addCredits(siteId, amount, meta)` | Top-up by Backyard admin | Transaction |
| `initTenantCredits(siteId)` | Seed `DEFAULT_FREE_CREDITS` (100) on tenant creation. Called from `createTenant` Cloud Function | Batch |
| `getCreditBalance(siteId)` | Read current balance. Returns zeros if doc missing | Read |

### Design notes

- Deducts use Firestore transactions to prevent double-spend race conditions.
- Refunds intentionally don't use a transaction (only-additive is safe).
- Ledger is the source of truth for auditing — every state change appends a row.

Consumed by [app/api/admin/ai/credits/route.ts](../../clicker-platform-v2/app/api/admin/ai/credits/route.ts) and the `ai_marketing` module.

---

## 2. AI Marketing Module

Location: [clicker-platform-v2/lib/modules/ai-marketing/](../../clicker-platform-v2/lib/modules/ai-marketing/)

Tenant-facing AI marketing studio: site owners generate ad copy, captions, headlines, campaign plans, and analytics via LLM agents, paid via the platform credit ledger above.

### Architecture (four layers)

**1. Agents** — prompt builders organized by role:

- `visual_analyst` — analyzes uploaded model / background / product photos, extracts colors, builds visual prompts
- `creative_director` — ad copy, captions, headlines, CTAs, hashtags, tone adaptation, translation
- `strategist` — campaign plans, audience definition, platform suggestions, content calendars, budget allocation
- `data_analyst` — performance analysis, trend identification, ROI, reports

**2. Skills catalog** — [config/skills-catalog.ts](../../clicker-platform-v2/lib/modules/ai-marketing/config/skills-catalog.ts)

Each skill = a UI-facing capability with a form schema, an agent, and a credit cost from `SKILL_CREDIT_COST` (in [config/model-config.ts](../../clicker-platform-v2/lib/modules/ai-marketing/config/model-config.ts)). The Generate page renders these as cards with auto-built forms.

**3. Orchestrator** (server-only) — [orchestrator/runner.ts](../../clicker-platform-v2/lib/modules/ai-marketing/orchestrator/runner.ts), [flows.ts](../../clicker-platform-v2/lib/modules/ai-marketing/orchestrator/flows.ts), [credit-estimator.ts](../../clicker-platform-v2/lib/modules/ai-marketing/orchestrator/credit-estimator.ts)

The runner:
1. Picks the right model from `SKILL_MODEL_MAP`
2. Builds the prompt via the agent template
3. Calls `invokeAI` against OpenRouter ([lib/ai/openrouter-client.ts](../../clicker-platform-v2/lib/ai/openrouter-client.ts))
4. Supports multi-skill flows where outputs from step N feed `priorContext` of step N+1

**4. Admin UI** — [admin/](../../clicker-platform-v2/lib/modules/ai-marketing/admin/)

Eight pages: Dashboard, Generate, Assets (+ detail), Campaigns (+ detail), Analytics, Settings.

### Admin routes

Base path: `/admin/marketing` — defined in [constants.ts:22](../../clicker-platform-v2/lib/modules/ai-marketing/constants.ts#L22)

| Page | Path |
|---|---|
| Dashboard | `/admin/marketing/dashboard` |
| Generate | `/admin/marketing/generate` |
| Assets | `/admin/marketing/assets` |
| Asset detail | `/admin/marketing/assets/detail` |
| Campaigns | `/admin/marketing/campaigns` |
| Campaign detail | `/admin/marketing/campaigns/detail` |
| Analytics | `/admin/marketing/analytics` |
| Settings | `/admin/marketing/settings` |

### Firestore layout (per tenant)

Constants in [constants.ts:7](../../clicker-platform-v2/lib/modules/ai-marketing/constants.ts#L7) — never hardcode these strings elsewhere.

- `sites/{siteId}/modules/ai_marketing/settings/default` — brand voice + default platforms
- `…/assets` — uploaded marketing assets with `AssetAnalysis` (subject, composition, lighting, colors, generated prompt)
- `…/generations` — log of every AI call
- `…/saved_content` — user-saved outputs
- `…/campaigns` — campaign plans (`draft` → `planned` → `active` → `paused` → `completed`)

### Storage

100 MB cap per tenant in `marketing-assets/`.

### Integration points

- **Credits** — every skill call calls `deductCredits(siteId, creditCost, …)` before the AI invocation, and `refundCredits` on failure. Generate page surfaces balance via [hooks/use-credits.ts](../../clicker-platform-v2/lib/modules/ai-marketing/hooks/use-credits.ts) hitting `/api/admin/ai/credits`.
- **Brand voice** — `MarketingSettings.brandVoice` (tone / style / languages / audience / key messages) is threaded into every Creative Director prompt for consistency.
- **Assets → generation** — visual analysis output (`generatedPrompt`) feeds downstream copy skills as `priorContext` in multi-skill flows.

---

## TL;DR

`ai_marketing` is the tenant-facing "AI content factory" — pluggable skills, agent-based prompt templates, OpenRouter for model calls, gated by the platform-wide credit ledger in `lib/ai/credits.ts`. New AI modules should reuse the same credit ledger rather than rolling their own.

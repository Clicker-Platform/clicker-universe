# AI Boosters Initiative — Brainstorm Notes

**Date:** 2026-05-06
**Status:** Brainstorm in progress. No spec or plan committed yet.
**Goal:** Add embedded, optional AI capabilities to every Clicker module + core platform. Customer-funded via AI credits; OpenRouter as the gateway.

---

## Current AI Infrastructure (already built)

- `clicker-platform-v2/lib/ai/openrouter-client.ts` — universal multi-provider client (Claude, GPT-4o, Gemini)
- `clicker-platform-v2/lib/ai/credits.ts` — atomic Firestore credit transactions, ledger, refund-on-failure, `addCredits()` for manual top-up
- `clicker-platform-v2/lib/modules/ai-sales-agent/server/gemini-client.ts` — direct Gemini SDK with function calling (legacy path, leave alone)
- `clicker-platform-v2/lib/modules/stocklens/server/gemini-scanner.ts` — Gemini Vision for SKU recognition (legacy path, leave alone)
- `clicker-platform-v2/lib/modules/ai-marketing/` — production module with 21 skills across 4 agent archetypes; uses OpenRouter; skill-priced credits (1–8 per skill)

**Not implemented:** PostHog event tracking (spec exists, not built). No AI-specific telemetry yet.

---

## Settled Decisions

1. **Boosters are embedded in each module's existing UI**, not a separate AI panel. Each booster is *optional* — toggleable per tenant.
2. **Customer pays via AI credits.**
   - **Phase 1:** Clicker tops up OpenRouter manually; Backyard admin tops up tenant credits via existing `addCredits()`.
   - **Phase 2:** self-serve credit purchase by tenant.
3. **Skill-priced credit model continues** (matches AI Marketing pattern). Each booster skill has a fixed credit cost regardless of underlying model.
4. **OpenRouter is the gateway for all new boosters.** Existing Gemini-direct paths (Sales Agent, StockLens) stay as-is — migration creates risk without benefit.
5. **Brand voice locked by marketing** (clicker.id promo image, May 2026):
   - *"AI yang ngerti bisnis Anda"* — must be tenant-context-grounded, not generic
   - *"Bukan sekadar balas chat"* — operational AI, not chatbot-style
   - **Yellow alert card** is the dominant visual: observation + suggested action CTA
   - Examples from mockups:
     - *"AI: Stok Arabica hampir habis. Reorder sekarang?"*
     - *"AI: 12 member belum transaksi 30 hari terakhir. Kirim promo?"*
     - *"AI: MORECLICK hampir habis quota. Perpanjang lagi atau buat promo baru?"*

---

## Three AI Surfaces (vocabulary for all module boosters)

1. **AI Insight Card** — yellow card, observation + CTA, fired by data conditions (the dominant pattern from marketing mockups)
2. **AI Action Button** — pink/branded button for on-demand generation (e.g., "AI Content Writer", "AI Laporan Harian", "AI Kirim Pengingat")
3. **AI Outbound Digest** — scheduled summaries pushed to WhatsApp/email ("Laporan harian dikirim otomatis ke WhatsApp Anda")

Every module booster will be some combination of these three.

---

## Trigger Model — Hybrid (settled direction)

Each booster declares its own trigger shape. Three trigger types, used per fit:

| Type | Use for | Cost shape |
|---|---|---|
| **Event-driven** (Firestore `onWrite`) | Discrete low-frequency events: stock-out, promo redemption, new member signup | Pay per real event |
| **Scheduled** | "Stale condition" checks: member dormancy, sales trends, daily report | Pay per tick × eligible tenants |
| **On page load** (client-triggered server check) | "User is looking at this screen right now": today's POS insights, current inventory check | Pay per active session |

### Cost discipline rules

- **Conditions detected in Firestore queries, not AI.** AI only invoked when there's something worth saying.
- **Tenant credit balance gates every AI call** via `deductCredits()` — zero credits = zero AI cost.
- **Scheduled orchestrator filters** to `tenants where aiBoostersEnabled AND creditBalance > 0` at the top, so freeloading tenants cost zero CPU.

---

## Cloud Functions Cost Concern — Resolved Direction

**Two costs are distinct:**

| Cost | Who pays | Notes |
|---|---|---|
| **AI cost** | Customer (in credits) → Clicker pays OpenRouter (in USD) | Revenue-funded, healthy margin |
| **Orchestration cost** (Cloud Functions / Cloud Run / cron) | Clicker | No direct revenue line — the "hidden cost" to manage |

### Phase 1 infrastructure choice

**Avoid Cloud Functions entirely.** Use **Next.js API route + external cron** (cron-job.org / Upstash QStash free tier / GitHub Actions schedule) hitting `/api/cron/ai-boosters`. Zero new infrastructure surface; runs on existing Next.js deployment.

### Phase 2+ migration path

If/when Phase 1 outgrows Next.js timeout limits, migrate scheduled jobs to a single Cloud Run service (one Cloud Scheduler → one orchestrator → fan-out via Pub/Sub if needed). Cloud Run free tier is generous; likely $0 for a long time.

Firestore `onWrite` triggers for event-driven boosters are fine cost-wise because they fire only on real events.

**Pattern hierarchy by cost-efficiency** (cheapest → most expensive):
- D — client-side trigger
- C — Firestore `onWrite` trigger
- A — Cloud Run scheduled
- B — Next.js cron + external scheduler ← **Phase 1 default**

---

## Brand Voice Clarification — Important for Implementers

There is a memory rule from 2026-05-01: *"No sparkle decorations on silent automation"* (`feedback_no_ai_ui.md`). It was created when a Sparkles + "Auto-apply best promo" button was removed from PromoApplicator because the feature was *rule-based, not actually AI*.

**That rule still applies for rule-based features. It does NOT apply to real AI Boosters.**

The distinction:

| Feature type | UI treatment |
|---|---|
| Rule-based logic running silently | No sparkle, no "AI" label. Run quietly. |
| Real LLM-backed feature consuming AI credits | Use the "AI: ..." card pattern or "AI [Action]" branded button — that's the locked Clicker brand. |

The reason: customers paying credits for AI need to *see* clearly that they're invoking AI. Hiding it would break the credit/billing model.

---

## Open Questions (next brainstorm sessions)

- **Booster off-state UX:** invisible / visible-but-locked / upsell-on-demand — not yet decided
- **Booster code location:** inside each module (`lib/modules/{x}/boosters/`) vs. shared registry (`lib/ai/boosters/`) — not yet decided
- **Per-booster skill→model→credit-cost matrix** — separate spec, similar to `lib/modules/ai-marketing/config/model-config.ts`
- **Phase 1 module prioritization** — mockups suggest POS, Inventory, Membership, Promo, Canvas Studio as launch candidates; full prioritization TBD
- **Tenant context-builder pattern** — each module needs a small helper that pulls tenant data (transactions, stock, members, promos) into the prompt. Design as first-class concept; needed to deliver on *"AI yang ngerti bisnis Anda"*

---

## Why: Constraints Driving the Design

- Marketing has publicly promised tenant-grounded, operational (not chatbot) AI — design must deliver this or brand breaks
- Customers are Indonesian F&B SMEs (1–10 locations) — credit pricing must be affordable in IDR; UI must feel approachable, not enterprise
- Existing AI Marketing module proves the skill-priced credit pattern works in production; reuse, don't reinvent

---

## Next Step

Continue the brainstorm with the **booster off-state UX** question (invisible / visible-but-locked / upsell). Then booster code location, then per-module skill matrix. Once settled, write the spec to `dev/superpowers/specs/YYYY-MM-DD-ai-boosters-design.md`.

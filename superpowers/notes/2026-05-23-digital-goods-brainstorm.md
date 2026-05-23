# Digital Goods Module — Brainstorm Session Notes (2026-05-23)

Companion notes to [spec](../specs/2026-05-23-digital-goods-module-design.md) and [Plan 1](../plans/2026-05-23-digital-goods-plan-1-foundation.md). Captures decisions, rejected options, and *why* — for future sessions that need to understand how we got here.

## Business context

- Partner: finance/debt/pinjol content creator, 64K IG followers, currently sells per-minute phone consultations (Rp 2k–4k/min, ~Rp 20M/month).
- Three business phases (per partner's plan): (1) sell content/ebooks, (2) AI-assisted consultation, (3) asset management + marketplace.
- **Only Phase 1 is in scope.** Phases 2 and 3 are deferred indefinitely.
- Revenue share: Clicker 20% / tenant 80%. Clicker covers infra in Phase 1.
- Launch target: mid-June 2026. Spec written 2026-05-23. ~3 weeks runway.
- VC pitch context: meeting with SPILL Ventures (week of 2026-05-23). This module is proof-point for "Clicker as creator tooling platform," not marketplace.

## Strategic framing decisions

- **Clicker is NOT a marketplace.** Each tenant runs their own brand on their own domain (often custom). The module is for *tenants who want to sell digital goods*, not all tenants. Gumroad was used as a feature inspiration, not a business-model template.
- **Buyer is tenant-scoped**, perceived. Magic-link emails come from tenant's brand via per-tenant Resend templates. Buyer never sees "Clicker."
- **Identity is platform-shared** under the hood. Firebase Auth de-dupes by email, so if a buyer logs into Tenant A then Tenant B with the same email, they're the same Firebase user with two `Member` docs. This is **Firebase default behavior** — Option B from brainstorm — and required zero extra work. Initially miscommunicated as "more complex than Option A" — wrong; it's actually the lazy/default path.
- **Why "buyer doesn't notice" works:** Magic-link login has no "account exists" branch. No password = no signup vs. login distinction. So even on Tenant B (second tenant for the same email), the experience is "enter email → click link → you're in" — identical to a brand-new signup. Per-tenant email branding seals the perception.

## Rejected options (and why)

- **Rename `membership` module → `loyalty`** to free the name for this new module. Tempting, but rename is 4–6h of careful mechanical work with real silent-fail risk (CLAUDE.md rule #7). Deferred to post-launch (Path C). New module gets working name `digital_goods`.
- **Make digital_goods own its own buyer-identity collection** (Option 2 in the membership-relationship discussion). Rejected — would produce two parallel customer lists per tenant forever. Bad data hygiene.
- **Approach 1 (Clicker as payment aggregator).** Rejected for MVP — requires months of legal work (OJK registration or partnership with Xendit Marketplace). Documented as v3 in spec roadmap.
- **Approach 2 (tenant connects own PG keys).** Rejected for MVP — 5–8 days engineering, plus tenant has to do their own Midtrans/Xendit onboarding (1–7 days). Possible but tight for 3-week timeline with one tenant. Documented as v2.
- **Approach 3 (manual transfer + tenant confirmation).** Chosen for MVP. 2 days engineering, zero legal risk, validates demand before committing to PG architecture. User's own raw notes already pointed at this ("tahap awal bisa manual dulu. Validasi.").
- **Course/LMS in MVP** (Option 3 in product-model discussion). Rejected for MVP — adds course builder UI, player UI, progress tracking; easily 4–5 days extra. Schema reserves `course?` field so v1.2 can slot in.
- **Subscription in MVP** (Option 4). Rejected for MVP — renewal failures, dunning, proration complexity. v1.5+ if creator's recurring consultation business model demands it.
- **Cloudflare R2 / Bunny / Mux for video.** Premature optimization. Firebase Storage cost for PDFs at 5K–10K downloads/month is $3–12 (sanity-checked during brainstorm). YouTube unlisted handles video at zero infra cost. Re-evaluate only if traffic justifies.
- **Cart, guest checkout, refund workflow, WhatsApp notifications, Canvas Studio block, promo codes.** All explicitly out of MVP per spec §12.

## Cross-module audit (corrections made mid-spec)

Originally placed library entries under `sites/{siteId}/members/{memberId}/library/...` — i.e., **inside the membership module's path**. User caught this. Corrected to flat collection `sites/{siteId}/modules/digital_goods/library/` with `memberId` as a foreign-key field. Same correction applied to other paths (top-level `digital_products` → nested under `modules/digital_goods/`).

**Rule reinforced:** every module's data lives under `sites/{siteId}/modules/{moduleId}/`. Cross-module references use FK fields + facade calls per CLAUDE.md rules #1 and #6. Storage paths mirror Firestore paths.

## What MVP forward-compat checklist preserves

- `Order.paymentMethod` is a string enum — v2 just adds `'midtrans' | 'xendit'`. Additive.
- `Order.amount` is buyer-paid gross — v3 adds `Order.fees: { pg, platform, net }`. Additive.
- `paymentInstructions` is snapshotted per-order — historical orders unaffected if tenant changes payment setup.
- `Product.files` is always an array — v1.1 (Bundle) just grows length from 1 to N. No schema change.
- `Product.type` is a string enum — v1.1 adds `'bundle'`, v1.2 adds `'course'`. Additive.
- `course?` and `progress?` are reserved optional fields — absent in MVP, present in v1.2.
- Payment credentials reserved path: `sites/{siteId}/integrations/{provider}` — NOT built in MVP. Principle locked: separate doc, encrypted at rest, server-only reads. **MVP rule: never put payment credentials on the main site doc.**
- Revshare deal (20%) NOT modeled in code. v3 will store in `sites/{siteId}/billing/terms` — never inline in order records.

## Plan structure

User chose B: three sub-plans, each ships working software.
- **Plan 1 — Foundation** (written, committed): scaffolding + admin products CRUD + settings. ~3 days, 16 tasks.
- **Plan 2 — Purchase flow** (not written): public store + checkout + orders + manual-confirm + emails + library + signed URLs. ~4 days, ~60 steps.
- **Plan 3 — Polish** (not written): loyalty integration + already-purchased guard + PostHog + dogfood. ~1.5 days, ~25 steps.

Plans 2 and 3 deliberately not pre-written. Write each after the previous ships so we can fold in learnings.

## Execution

User chose to defer execution. When picked up later: subagent-driven-development is the recommended sub-skill for Plan 1.

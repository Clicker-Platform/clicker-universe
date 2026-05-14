# ARCHITECTURE.md — Gap Audit

**File audited:** `clicker-platform-v2/docs/ARCHITECTURE.md` (634 lines, last updated 2026-04-21)
**Audit date:** 2026-05-14
**Method:** Section-by-section comparison against the live codebase (package.json, `lib/`, `app/`, `middleware.ts`, module/template definitions).

Legend:
- 🔴 **Wrong** — actively incorrect, will mislead a reader
- 🟡 **Stale** — incomplete or out-of-date
- 🟢 **Missing** — major subsystem absent from doc entirely
- ⚪ **OK** — verified accurate

---

## §1. System Overview

| Claim | Reality | Status |
|---|---|---|
| "Optional add-on modules (POS, Inventory, Membership, Reservations, AI Sales Agent, AI Marketing)" | Live modules also include **service_records, sales_pipeline, promo, fintrack, stocklens, ai-platform**. Missing 5 modules from the elevator pitch. | 🟡 |
| "A template (theme) chosen from **5** prebuilt designs" | `lib/templates/definitions.ts` registers **6** (classic, modern, sojourner, shuvo, mrb, mrb-light). Doc contradicts itself — §6 correctly says 6. | 🔴 |
| Tech stack: Next.js v16+, React 19, Firebase, Tailwind v4, @dnd-kit, Tiptap v3 | All correct. **Missing from tech stack:** `@google/generative-ai` (Gemini), `posthog-js` (analytics), `@react-pdf/renderer` (warranty PDFs), `@upstash/redis` (rate limiting), `isomorphic-dompurify` (HTML sanitization), `sharp` (image processing), `pdf-parse` + `cheerio` (knowledge sync), `lottie-react`. Resend (email) is in auth-gateway + functions; integration is real per memory but no SDK in platform package.json — invoked via API. | 🟡 |
| No mention of Node version | `engines.node = "22"` is pinned. Worth noting. | 🟡 |

---

## §2. Repository Structure

| Claim | Reality | Status |
|---|---|---|
| Top-level layout shows `clicker-platform-v2, auth-gateway, backyard, functions, scripts` | Correct. | ⚪ |
| `clicker-platform-v2/` shows `app, components, lib, data, hooks, scripts, middleware.ts, firestore.rules, storage.rules` | Correct skeleton. **Missing from inventory:** `docs/` (this doc lives there), `tests/` if present, `public/`. Not necessarily wrong, but the listing isn't exhaustive. | 🟡 |
| `lib/` is described loosely | `lib/` now contains substantial top-level subsystems not mentioned anywhere: **`lib/ai/`, `lib/analytics/`, `lib/email/`, `lib/registration/`, `lib/whatsapp/`, `lib/core/`, `lib/media/`, `lib/forms/`, `lib/admin/`, `lib/cache/`, `lib/secrets/`, `lib/hooks/`, `lib/utils/`** plus `inbox-panel-context.tsx`, `top-bar-slot-context.tsx`, `resolveNavHref.ts`, `sanitizeHtml.ts`, `logger.ts`, `logger-edge.ts`, `imageUtils.ts`, `upload.ts`. | 🟢 |

---

## §3. Multi-Tenant Routing

| Claim | Reality | Status |
|---|---|---|
| Subdomain detection: `x-clicker-original-host` → `x-forwarded-host` → `host` | Correct. | ⚪ |
| Special routes that bypass tenant logic: `admin, auth, member, catalog, api, _next` | Actual list in middleware: `admin, auth, member, catalog, login, register, invite, setup, dashboard, api, _next, warranty`. Missing **login, register, invite, setup, dashboard, warranty**. | 🔴 |
| Subdomain rewrite + admin auth gate + double-prefix sanitizer + x-site-id header | All present in middleware. ⚪ But doc omits: **`isFirebaseDefaultDomain` handling** (web.app domains forced to path-based), `NEXT_PUBLIC_BASE_DOMAIN` env requirement, localhost handling. | 🟡 |
| App Router files table | `app/[tenant]/page.tsx`, `[...slug]/page.tsx`, `app/admin/(dashboard)/layout.tsx`, `[...slug]/page.tsx` all exist. **Missing rows:** registration (`/register`), warranty (`/warranty/[code]`), member portal, auth gateway pages. | 🟡 |

---

## §4. Core vs Module Boundary

| Claim | Reality | Status |
|---|---|---|
| Core dirs: settings, pages, links, forms, products, canvas | Actual admin dashboard dirs: `ai-usage, canvas, debug-auth, forms, inbox, links, pages, pos, products, promo, seed-modules, service-records, services, settings, template, whatsapp`. Doc misses **inbox, ai-usage, template, whatsapp, services, debug-auth, seed-modules**. (Some are module-owned routes that bypass `[...slug]` — worth clarifying why.) | 🔴 |
| Module list shown: `byod_pos, membership, inventory, reservation, ai_sales, service_records, sales_pipeline, ai_marketing` | Live modules in `lib/modules/`: **adds `promo`, `fintrack`, `stocklens`, `ai-platform`**. Missing 4. | 🔴 |
| Golden Rule 2: "Modules MUST NOT import from other modules" | CLAUDE.md and this doc agree, but the **promo facade** (`@/lib/modules/promo/api`) is an explicit sanctioned exception, same as `membership/api`. Doc doesn't mention either exception. | 🟡 |

---

## §5. Module System

| Claim | Reality | Status |
|---|---|---|
| 4 required registration files: `definitions.ts, components.tsx, registry.ts, seed-modules.ts` | Correct. `lib/modules/` also has `client-registry.tsx` not mentioned. | 🟡 |
| 3-way parity rule (platform + backyard + seed) | Correct as a rule. | ⚪ |
| Module folder structure (admin/, public/, components/, api.ts, api-admin.ts, api-server.ts, api-reports.ts, constants.ts, types.ts, utils.ts) | Accurate aspirational shape. Note: **promo** uses an `api/` subdirectory (claim.ts, commit.ts, discount.ts, evaluator.ts, promos.ts, settings.ts, vouchers.ts) rather than a flat `api.ts` — this is the facade pattern referenced in CLAUDE.md but not documented here. | 🟡 |
| Registered modules table (8 rows) | Actual: **12 registered** (`byod_pos, membership, inventory, stocklens, reservation, ai_sales, sales_pipeline, service_records, fintrack, promo, ai_marketing` + `ai-platform` in filesystem). Missing rows for `promo, fintrack, stocklens, ai-platform`. Also **`service_records` admin routes** in doc list 9 routes, actual definition has 9 routes matching — ⚪ for that subrow. **`byod_pos`** doc says "Cashier, KDS, Transactions, Menu Manager, Settings, Orders" but definitions.ts has Cashier, Kitchen, Transactions, Menu, Configuration, Reports — labels drifted. | 🔴 |
| Naming note: "Module IDs use underscores, directories use hyphens" | Mostly true but inconsistent in practice: `byod_pos` dir uses underscore, `fintrack` no separator, `promo` no separator. The rule is closer to: IDs use underscores when multi-word; directories follow the original module slug. | 🟡 |
| ModuleDefinition type | Matches `types.ts` reasonably well. Doc may be missing newer fields — not verified line-by-line. | 🟡 |

---

## §6. Template & Theme System

| Claim | Reality | Status |
|---|---|---|
| 6 templates listed correctly | Matches `lib/templates/definitions.ts`. | ⚪ |
| Template files (`definitions.ts, registry.ts, layoutUtils.ts, service.ts, types.ts`) | All present, correct. | ⚪ |
| MRB block overrides: MrbHero, MrbQuickActions, MrbOperatingHours; custom header MrbHeader | Plausible — only `MrbHeader.tsx` confirmed under `components/headers/`. Block overrides live in `components/blocks/mrb/` (confirmed dir exists). | ⚪ |
| Headers folder | Contains only **ClassicProfileHeader, ModernProfileHeader, MrbHeader, ShuvoHeader**. Doc doesn't explain that `sojourner` and `mrb-light` reuse other headers (or use default). | 🟡 |

---

## §7. Block System (Canvas Studio)

| Claim | Reality | Status |
|---|---|---|
| Block types table lists **14 types** (hero, text, image, button, products, faq, link, map, image_gallery, quick_actions, hours, featured_product, branches, social_embed) | Actual `BLOCK_OPTIONS` has **18 types**. Missing from doc: **`content_showcase`, `inline_form`, `heading`, `feature_cards`**. Also `DefaultProductGalleryBlock.tsx` exists as a renderer though not in BLOCK_OPTIONS — worth investigating. | 🔴 |
| Canvas Studio file layout | Accurate. | ⚪ |
| Override chain: template → module → default | Matches `BlockRenderer.tsx` behavior. | ⚪ |

---

## §8. Global Contexts

| Claim | Reality | Status |
|---|---|---|
| `useSite()` returns `{siteId, tenantSlug, isPending, isSubdomain}` | Matches exports. ⚪ But doc misses the **`setSiteId()`** setter referenced in CLAUDE.md auth flow — used by TokenBootstrap to switch tenant without reload. | 🟡 |
| `useUser()` returns `{user, role, isOwner, hasAccess, canEdit}` | Matches; also exports `getAccessLevel`. ⚪ | ⚪ |
| `useAdminTheme()` | File exists at `lib/use-admin-theme.tsx`. ⚪ | ⚪ |
| **Missing contexts:** `InboxPanelContext`, `TopBarSlotContext` exist as top-level lib files. Not documented. | | 🟢 |

---

## §9. Authentication & RBAC

| Claim | Reality | Status |
|---|---|---|
| Auth flow diagram (middleware → __session → x-site-id → SiteProvider + UserProvider) | Correct at high level. **Missing** the entire **TokenBootstrap handoff flow** from auth-gateway documented in CLAUDE.md (custom token in URL fragment, `__token_bootstrapping` sessionStorage flag, `signInWithCustomToken`, etc.). Major gap. | 🔴 |
| Roles table: owner (`*`) + staff (granular) | `lib/rbac.ts` defines **4 roles**: `owner, editor, viewer, staff` with `PERMISSIONS` map (`manage_site, manage_users, manage_content, view_analytics`). Doc only mentions 2. | 🔴 |
| moduleAccess JSON example | Shape is correct. | ⚪ |
| RBAC guard pattern | Correct. | ⚪ |
| Module alias `byod_pos ↔ pos` | Verified in user-context.tsx (handles both `getAccessLevel` and permission strings). | ⚪ |

---

## §10. Database Paths

| Claim | Reality | Status |
|---|---|---|
| Core data table | All correct. **Missing:** registration leads (`registration/leads`?), AI usage (`aiUsage/{day}` per memory), email log (`emailLog/{id}` per memory), reminderQueue, warrantyCards. | 🟡 |
| Module path pattern: `sites/{siteId}/modules/{module_id}/{collection}` | Mostly true but **sales_pipeline writes leads to `sites/{siteId}/leads/{leadId}`** (top-level, not under `modules/`) — doc notes this exception. ⚪ on this row. | ⚪ |
| Module examples table | Misses: **promo** (`modules/promo/promos`, `modules/promo/vouchers`, `modules/promo/settings/config`), **fintrack** (8 collections), **stocklens** (`modules/stocklens/skus`), **service_records** (serviceRecords, vehicles, reminderQueue, warrantyCards, serviceTypes), **ai_marketing** (5 collections). | 🔴 |
| Global module registry `modules/{module_id}` | Verified pattern. | ⚪ |

---

## §11. API Routes

Doc lists ~16 route groups. Actual `app/api/` tree has **39 directories**. Missing from doc:

| Missing API route | Purpose |
|---|---|
| `admin/ai-credits/` | AI Kredit balance |
| `admin/ai-usage/` | AI usage aggregation (per memory: daily aggregate + topup-only log) |
| `admin/modules/ai-marketing/assets/upload\|analyze` | More granular than "asset generation" |
| `admin/modules/ai-marketing/campaigns/[id]` | Per-campaign API |
| `admin/modules/ai-marketing/config\|export\|saved` | Several sub-endpoints |
| `admin/modules/ai-sales-agent/config` | AI sales config endpoint |
| `debug-firebase/` | Debug endpoint |
| `log/client-error/` | Client-side error logging |
| `proxy/lottie/` | Lottie proxy |
| `public/validate-promo/` | Promo code validation (public-facing) |
| `stocklens/check-sku\|scan\|settings\|test-key` | Whole stocklens module API |

Doc says `webhooks/wa/` — actual path is `webhook/whatsapp/` (singular `webhook`, full word `whatsapp`). 🔴

Server vs client SDK rule (firebase-admin vs firebase client): correct. ⚪

---

## §12. Admin UI Conventions

Style snippets look correct as conventions. Worth verifying:
- Card style with `border-gray-200`, `rounded-2xl` — matches what's used in newer admin pages.
- Anti-patterns list is useful and worth keeping.

Status: ⚪ — but consider adding the **dark mode conventions** (`useAdminTheme`, `dark:` class patterns) per the `admin_dark_theme` skill, currently absent.

---

## §13. Key File Index

Mostly fine, but **stale/missing entries**:
- Missing: `lib/ai/credits.ts`, `lib/ai/client.ts`, `lib/email/sender.ts`, `lib/analytics/PostHogProvider.tsx`, `lib/whatsapp/gateway.ts`, `lib/registration/submit-action.ts`, `lib/core/businessHours/`, `lib/core/serviceCatalog/`, `lib/admin-auth.ts`, `lib/api-auth.ts`, `lib/sanitizeHtml.ts`, `lib/logger.ts`.
- Doc says "5 template configs" in the description for `lib/templates/definitions.ts` — should be **6**. 🔴

---

## §14. Data Flow Diagrams

- Public page render diagram: accurate at the right level. ⚪
- Admin module route diagram: accurate. ⚪
- Module enable check example: accurate. ⚪

---

## 🟢 Major Subsystems Entirely Missing from Doc

These are real, implemented subsystems with no representation in ARCHITECTURE.md:

1. **AI Platform / Kredit system** (`lib/ai/`)
   - `client.ts`, `credits.ts`, `models.ts`, `pricing.ts`, `context.ts`
   - Aggregates daily usage, Kredit balance, topup log
   - Wires into ai_sales, ai_marketing, stocklens

2. **Email infrastructure** (`lib/email/`)
   - Resend integration (per memory, ratified)
   - `sender.ts` exposing `sendEmail({siteId, to, templateAlias, variables})`
   - `guard.ts`, `log.ts`, `config.ts`
   - Used by registration, ai-sales follow-ups, etc.

3. **Analytics** (`lib/analytics/`)
   - PostHog wiring with `siteId` super-property
   - 7 events across 6 modules per memory

4. **WhatsApp Cloud API integration** (`lib/whatsapp/`)
   - Gateway, webhook processor, contact classifier, encryption, phone, message router
   - Admin UI under `/admin/whatsapp`
   - Webhook at `/api/webhook/whatsapp`

5. **Registration flow** (`lib/registration/`)
   - Public lead capture at `clicker.id/register`
   - Bundles, modules catalog, slug generation, rate limiting, event log

6. **Promo Engine facade** (`lib/modules/promo/api/`)
   - Cross-module-importable facade (designated exception to module isolation rule)
   - `claim.ts, commit.ts, discount.ts, evaluator.ts, promos.ts, settings.ts, vouchers.ts`

7. **Core business primitives** (`lib/core/`)
   - `businessHours/`, `serviceCatalog/` — shared by multiple modules

8. **Inbox + TopBar slot contexts** (`lib/inbox-panel-context.tsx`, `lib/top-bar-slot-context.tsx`)
   - Global UI state for admin slots

9. **Auth Gateway handoff** (cross-app)
   - Custom token flow with sessionStorage bootstrap flag, `setSiteId()` setter, `TokenBootstrap.tsx`
   - Documented in CLAUDE.md but absent from ARCHITECTURE.md

10. **Storage & Upload** (`lib/upload.ts`, `lib/imageUtils.ts`, `lib/media/`)
    - Firebase Storage usage patterns, `sharp` resizing, validation

---

## Summary

| Severity | Count |
|---|---|
| 🔴 Wrong (will mislead) | ~12 items |
| 🟡 Stale (incomplete/outdated) | ~15 items |
| 🟢 Missing subsystem | 10 |
| ⚪ Verified accurate | ~12 |

**The headline finding:** the doc is structurally sound but reflects a snapshot of the platform from before the AI/Email/Analytics/WhatsApp/Registration/Promo-engine wave of work. The module count is wrong (8 → 12), template count contradicts itself (5 in §1, 6 in §6), block count is wrong (14 → 18), and entire subsystems aren't mentioned.

## Recommendation for the Rewrite

Based on the gaps, a refresh should:

1. **Fix all 🔴 items inline** — these are factual errors.
2. **Refresh 🟡 items** — module table, special routes list, block types, file index, repo structure.
3. **Add new sections** for 🟢 subsystems. Suggested new sections:
   - §15. AI Platform & Kredit System
   - §16. Email (Resend)
   - §17. Analytics (PostHog)
   - §18. WhatsApp Integration
   - §19. Registration Flow
   - §20. Cross-app Auth (Token Bootstrap)
4. **Expand §4** to clarify the sanctioned facade exceptions (`promo/api`, `membership/api`).
5. **Promote §9 auth flow** to include the TokenBootstrap handoff (currently only in CLAUDE.md).
6. **Verify CLAUDE.md, AGENTS.md, ARCHITECTURE.md are not diverging** — there's content in CLAUDE.md (auth flow) that should arguably live here.

After your review of this gap report, the next step would be drafting a refreshed ARCHITECTURE.md (or a structured rewrite plan).

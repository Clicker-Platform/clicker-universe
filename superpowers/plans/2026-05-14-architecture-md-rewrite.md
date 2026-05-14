# ARCHITECTURE.md Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `clicker-platform-v2/docs/ARCHITECTURE.md` to be the single source of truth for the platform, organized into four themed parts, with all currently-implemented subsystems documented and all factual drift fixed.

**Architecture:** Replace existing 14-section doc with a 24-section structure organized into Part I Foundation, Part II Extension Points, Part III Cross-Cutting Subsystems, Part IV Conventions & References. After rewrite, condense overlapping content in `CLAUDE.md` and add a preamble pointing to ARCHITECTURE.md as the source of truth.

**Tech Stack:** Markdown only. Sources of truth: `package.json`, `middleware.ts`, `lib/modules/definitions.ts`, `lib/templates/definitions.ts`, `components/admin/blocks/blockDefinitions.ts`, `lib/rbac.ts`, `lib/site-context.tsx`, `lib/user-context.tsx`, `lib/modules/{module}/constants.ts`, `app/api/` tree, `lib/ai/`, `lib/email/`, `lib/analytics/`, `lib/whatsapp/`, `lib/registration/`, `lib/core/`.

**Reference:** Gap audit at [`dev/superpowers/notes/2026-05-14-architecture-md-audit.md`](../notes/2026-05-14-architecture-md-audit.md).

---

## Working Approach for Every Task

Because this is a doc rewrite (no runtime tests), each task follows this pattern:

1. **Read source of truth** — open the cited files and confirm current state.
2. **Write the section** — produce the markdown content for that part.
3. **Self-check** — confirm every claim is grounded in a file you just read (no guessing from memory). If a claim can't be verified, mark it `[VERIFY]` and ask the user before committing.
4. **Commit** — one section per commit, so reviewers can read the diff section-by-section.

Filename to edit: `clicker-platform-v2/docs/ARCHITECTURE.md` (full rewrite — start by replacing contents entirely with the new skeleton in Task 0, then fill in section-by-section).

---

## Task 0: Set up new skeleton and remove old content

**Files:**
- Modify: `clicker-platform-v2/docs/ARCHITECTURE.md` (full replacement)

- [ ] **Step 1: Back up existing doc**

```bash
cp clicker-platform-v2/docs/ARCHITECTURE.md clicker-platform-v2/docs/ARCHITECTURE.old.md
```

- [ ] **Step 2: Replace contents with new skeleton**

Replace the entire file with:

```markdown
# Clicker Platform — Global Architecture Reference

> **Purpose:** Single source of truth for the Clicker Platform architecture. Read this before adding any feature, module, or template.
> **Last updated:** 2026-05-14

---

## Table of Contents

### Part I — Foundation
1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Multi-Tenant Routing](#3-multi-tenant-routing)
4. [Authentication & Session Handoff](#4-authentication--session-handoff)
5. [RBAC & Roles](#5-rbac--roles)

### Part II — Extension Points
6. [Core vs. Module Boundary](#6-core-vs-module-boundary)
7. [Module System](#7-module-system)
8. [Template & Theme System](#8-template--theme-system)
9. [Block System (Canvas Studio)](#9-block-system-canvas-studio)

### Part III — Cross-Cutting Subsystems
10. [AI Platform & Kredit](#10-ai-platform--kredit)
11. [Email (Resend)](#11-email-resend)
12. [Analytics (PostHog)](#12-analytics-posthog)
13. [WhatsApp Integration](#13-whatsapp-integration)
14. [Registration Flow](#14-registration-flow)
15. [Promo Engine Facade](#15-promo-engine-facade)
16. [Core Business Primitives](#16-core-business-primitives)
17. [Storage & Upload](#17-storage--upload)

### Part IV — Conventions & References
18. [Global Contexts](#18-global-contexts)
19. [Database Paths](#19-database-paths)
20. [API Routes](#20-api-routes)
21. [Admin UI Conventions](#21-admin-ui-conventions)
22. [Key File Index](#22-key-file-index)
23. [Data Flow Diagrams](#23-data-flow-diagrams)
24. [Appendices](#24-appendices)

---

<!-- Sections to be filled in by subsequent tasks -->
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md clicker-platform-v2/docs/ARCHITECTURE.old.md
git commit -m "docs(architecture): scaffold new 24-section structure"
```

---

## PART I — FOUNDATION

## Task 1: §1 System Overview

**Sources of truth to read:**
- `clicker-platform-v2/package.json` (full dependency list)
- `clicker-platform-v2/lib/modules/definitions.ts` (count of registered modules)
- `clicker-platform-v2/lib/templates/definitions.ts` (count of templates)

**What to write:** Replace the placeholder under `## 1. System Overview` with:

- Two-paragraph product description: multi-tenant SaaS, biolink/website + admin + opt-in modules + selectable template.
- Tech stack table with **all major runtime deps** grouped by purpose:
  - Framework: Next.js 16.1.6, React 19.2.3, TypeScript 5, Node 22
  - Data: Firebase 12 client SDK, firebase-admin 13
  - Styling: Tailwind CSS v4 (+ @tailwindcss/postcss, typography)
  - UI primitives: @dnd-kit, lucide-react, sonner, qrcode.react, lottie-react
  - Content: Tiptap v3, isomorphic-dompurify
  - AI: @google/generative-ai (Gemini)
  - Analytics: posthog-js
  - PDF: @react-pdf/renderer, pdf-parse
  - Image: sharp
  - Cache/Rate-limit: @upstash/redis
  - Knowledge sync: cheerio
- One-line mention of monorepo siblings (auth-gateway, backyard, functions) with cross-refs to §2.

- [ ] **Step 1: Read package.json and verify versions before writing**
- [ ] **Step 2: Write the section content above into ARCHITECTURE.md**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §1 system overview with full tech stack"
```

---

## Task 2: §2 Repository Structure

**Sources of truth:**
- `ls /Users/andre/Repository/clicker-universe/dev/` (monorepo root)
- `ls clicker-platform-v2/` (top-level)
- `ls clicker-platform-v2/lib/` (lib subsystems — many are new since last doc)

**What to write:**

- Monorepo tree: `clicker-platform-v2/`, `auth-gateway/` (port 3012), `backyard/` (port 3011), `functions/`, `scripts/`. Include one-line purpose for each.
- Platform top-level tree: `app/`, `components/`, `lib/`, `data/`, `hooks/`, `scripts/`, `middleware.ts`, `firestore.rules`, `storage.rules`, `docs/`.
- **NEW** `lib/` subsystem inventory (this is the most outdated part of the old doc) — list every top-level dir and file with a 1-line purpose:
  - `ai/`, `admin/`, `analytics/`, `cache/`, `core/`, `email/`, `forms/`, `hooks/`, `media/`, `modules/`, `registration/`, `secrets/`, `templates/`, `utils/`, `whatsapp/`
  - top-level files: `admin-auth.ts`, `api-auth.ts`, `fetchData.ts`, `firebase.ts`, `firebase-admin.ts`, `imageUtils.ts`, `inbox-panel-context.tsx`, `logger.ts`, `logger-edge.ts`, `rbac.ts`, `resolveNavHref.ts`, `sanitizeHtml.ts`, `site-context.tsx`, `systemBlocks.ts`, `top-bar-slot-context.tsx`, `upload.ts`, `use-admin-theme.tsx`, `use-admin-nav-groups.ts`, `use-admin-unread-counts.ts`, `user-context.tsx`, `utils.ts`

- [ ] **Step 1: Run `ls clicker-platform-v2/lib/` to confirm current contents**
- [ ] **Step 2: Write the section**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §2 repository structure with full lib/ inventory"
```

---

## Task 3: §3 Multi-Tenant Routing

**Sources of truth:**
- `clicker-platform-v2/middleware.ts` (read fully — 332 lines)

**What to write:**

- How tenants are identified: subdomain (production), path-based (dev / Firebase default `.web.app` domains).
- Subdomain detection precedence: `x-clicker-original-host` → `x-forwarded-host` → `host`.
- Required env: `NEXT_PUBLIC_BASE_DOMAIN` (middleware errors 500 if missing).
- Special routes list (full, not partial): `admin, auth, member, catalog, login, register, invite, setup, dashboard, api, _next, warranty`.
- isFirebaseDefaultDomain behavior (`.web.app` → forced path-based, no subdomain rewrites).
- Localhost handling: `kasisehat.localhost:3000` is rewritten to `kasisehat.{baseDomain}` internally for dev.
- Subdomain rewrite logic: `quattro.clicker.id/about` → internal rewrite to `/quattro/about`.
- Double-prefix sanitizer (prevents `/quattro/quattro/...` loops).
- `__session` cookie + redirect-to-auth-gateway logic.
- `x-site-id` header injection (cite line range).
- App Router files table updated with: `app/[tenant]/page.tsx`, `app/[tenant]/[...slug]/page.tsx`, `app/admin/(dashboard)/layout.tsx`, `app/admin/(dashboard)/[...slug]/page.tsx`, `app/register/`, `app/warranty/[warrantyCode]/`, `app/member/`, `app/catalog/`.

- [ ] **Step 1: Read full middleware.ts and confirm special routes list, env requirements, web.app behavior**
- [ ] **Step 2: Run `ls clicker-platform-v2/app/` to confirm app router roots (register, warranty, member, catalog)**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §3 multi-tenant routing with full middleware behavior"
```

---

## Task 4: §4 Authentication & Session Handoff

**Sources of truth:**
- `clicker-platform-v2/middleware.ts` (auth gate behavior)
- `clicker-platform-v2/components/admin/TokenBootstrap.tsx` (token bootstrap flow)
- `clicker-platform-v2/lib/site-context.tsx` (`setSiteId` setter)
- `clicker-platform-v2/lib/user-context.tsx` (auth state hookup, `__token_bootstrapping` flag)
- `auth-gateway/app/page.tsx` (login form + handoff)
- `auth-gateway/app/api/token/route.ts` (custom token mint)
- `auth-gateway/lib/get-user-sites.ts` (site resolution)
- The current `CLAUDE.md` auth-flow section (existing content to migrate verbatim then expand)

**What to write:**

This is the **biggest new section** in the rewrite. Includes:

- Architecture diagram: `auth-gateway (3012)` ↔ `platform (3000)` with custom-token handoff over URL fragment.
- Step-by-step login flow (7 steps — copy structure from CLAUDE.md but expand to be the canonical version):
  1. User opens auth-gateway → email + password
  2. Gateway: `signInWithEmailAndPassword`
  3. Parallel: `getUserSites` + `POST /api/token` (Firebase Admin `createCustomToken`)
  4. Redirect to `http://slug.clicker.id/admin#token=...&siteId=...` (fragment, not query)
  5. Platform layout → `TokenBootstrap` useEffect: reads `#token`, sets `__token_bootstrapping` sessionStorage flag, sets `__session` cookie, calls `setSiteId()`, then `signInWithCustomToken`
  6. `onAuthStateChanged` → `UserProvider` resolves member doc → role
  7. AdminGuard passes
- Subsequent visits flow (no gateway hop).
- Why URL fragment, not query: avoid server logs.
- Why sessionStorage flag: prevents AdminGuard from redirecting back to gateway mid-handoff.
- Cookie details: name `__session` (Firebase Hosting requirement), value = `siteId`, used by middleware to set `x-site-id`.
- Migration note: the old `generateHandoffToken` Cloud Function is **deprecated** — `/api/token` route replaces it.
- File index for auth flow (table form): every file in the chain on both apps.
- Rules block (what NOT to do — tenant logic in gateway, etc.).

- [ ] **Step 1: Read `components/admin/TokenBootstrap.tsx` and `lib/user-context.tsx` to verify flag name + setSiteId behavior**
- [ ] **Step 2: Read `auth-gateway/app/api/token/route.ts` and `auth-gateway/lib/get-user-sites.ts`**
- [ ] **Step 3: Write the section using the 7-step flow expanded to canonical detail**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §4 authentication & session handoff (canonical)"
```

---

## Task 5: §5 RBAC & Roles

**Sources of truth:**
- `clicker-platform-v2/lib/rbac.ts` (read fully — defines roles + permissions)
- `clicker-platform-v2/lib/user-context.tsx` (`hasAccess`, `canEdit`, `getAccessLevel`, byod_pos/pos alias)

**What to write:**

- The four roles: `owner`, `editor`, `viewer`, `staff` — table with what each can do.
- `PERMISSIONS` map from rbac.ts: `manage_site` (owner), `manage_users` (owner), `manage_content` (owner+editor), `view_analytics` (owner+editor+viewer). Cite source file.
- `moduleAccess` JSON example (sites/{siteId}/members/{uid}) — already correct in old doc, copy verbatim.
- RBAC guard pattern in client components (`canEdit` example).
- Module ID aliasing: `byod_pos ↔ pos` is handled in user-context.tsx for both `getAccessLevel` and permission strings. Show the actual alias lines.
- Owner shortcut: `permissions: ['*']` bypasses moduleAccess entirely.

- [ ] **Step 1: Read rbac.ts and user-context.tsx fully**
- [ ] **Step 2: Write the section**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §5 RBAC & roles with all 4 roles and PERMISSIONS map"
```

---

## PART II — EXTENSION POINTS

## Task 6: §6 Core vs Module Boundary

**Sources of truth:**
- `clicker-platform-v2/app/admin/(dashboard)/` directory listing
- `clicker-platform-v2/lib/modules/` directory listing
- Existing `CLAUDE.md` golden rules section

**What to write:**

- The ASCII box diagram (core vs modules) — update the **core list** to match reality: settings, pages, links, forms, products, canvas, inbox, services, template, ai-usage, whatsapp, promo, service-records, pos, seed-modules. (Note: some of these are module-owned routes that have a fixed core directory — call this out.)
- The four golden rules:
  1. Core can import from Core; Core NEVER imports from a module.
  2. Modules MUST NOT import from other modules — use `isModuleEnabled()` for cross-module logic.
  3. **Sanctioned exceptions:** modules MAY import from `@/lib/modules/promo/api` and `@/lib/modules/membership/api` (facade-only). These are documented exceptions to rule 2; no other cross-module imports are allowed.
  4. Module components are registered in the component registry and loaded dynamically.
  5. Module admin routes are served via the catch-all `app/admin/(dashboard)/[...slug]/page.tsx`.

- [ ] **Step 1: Run `ls clicker-platform-v2/app/admin/(dashboard)/` and verify the directory list**
- [ ] **Step 2: Run `ls clicker-platform-v2/lib/modules/` and verify the module list**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §6 core vs module boundary with sanctioned facade exceptions"
```

---

## Task 7: §7 Module System

**Sources of truth:**
- `clicker-platform-v2/lib/modules/definitions.ts` (full file)
- `clicker-platform-v2/lib/modules/types.ts` (ModuleDefinition type)
- `clicker-platform-v2/lib/modules/components.tsx` and `client-registry.tsx`
- `clicker-platform-v2/scripts/seed-modules.ts`
- `backyard/lib/modules/definitions.ts` (for 3-way parity confirmation)

**What to write:**

- Required registration files (now **5 not 4**):
  - `lib/modules/definitions.ts` (static admin route definitions)
  - `lib/modules/components.tsx` (dynamic component import registry)
  - `lib/modules/client-registry.tsx` (client-side registry)
  - `lib/modules/registry.ts` (runtime Firestore-based routing)
  - `scripts/seed-modules.ts` (Firestore seed)
- **3-way parity rule:** keep platform `lib/modules/definitions.ts`, `backyard/lib/modules/definitions.ts`, and `scripts/seed-modules.ts` identical for paths and componentKeys.
- Module folder structure (the aspirational shape) — keep the current admin/, public/, components/, api.ts, api-admin.ts, api-server.ts, api-reports.ts, constants.ts, types.ts, utils.ts. Add note about **facade pattern** (promo uses `api/` subdir with claim.ts, commit.ts, discount.ts, evaluator.ts, promos.ts, settings.ts, vouchers.ts).
- **Registered modules table — 12 rows (not 8):**
  - `byod_pos` (Self-Order POS): Cashier, Kitchen, Transactions, Menu, Configuration, Reports
  - `membership` (Membership & Loyalty): Members, Settings
  - `inventory` (Inventory): Items
  - `stocklens` (Stocklens): Scanner, Vault, Settings
  - `reservation` (Reservations): Bookings, Services, Staff (hidden), Settings
  - `ai_sales` (AI Sales Agent): Overview, Settings
  - `sales_pipeline` (Sales Pipeline): Pipeline Board, Settings
  - `service_records` (Service Records): Service, Reports, New Record (hidden), Record Detail (hidden), Vehicles, Vehicle Detail (hidden), Service Types, Reminders, Settings
  - `fintrack` (FinTrack): Dashboard, Entries, Wallets, New Entry (hidden), Advanced, Settings
  - `promo` (Promotions): Promotions, Vouchers, Settings
  - `ai_marketing` (AI Marketing): Dashboard, Generate, Assets, Asset Detail, Campaigns, Campaign Detail, Analytics, Settings (all hidden in current definition)
  - `ai-platform` (filesystem only, no definitions entry — note this discrepancy)
- Naming convention: IDs use underscores (`ai_sales`), directories may use hyphens (`lib/modules/ai-sales-agent/`). The `id` key in definitions is the canonical identifier used in Firestore and RBAC.
- ModuleDefinition type (copy from `types.ts`, not from memory).
- How module routes are served (keep the existing flow diagram — it's accurate).

- [ ] **Step 1: Read full `lib/modules/definitions.ts` to confirm every route label**
- [ ] **Step 2: Read `lib/modules/types.ts` for the canonical ModuleDefinition shape**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §7 module system with all 12 modules and facade pattern"
```

---

## Task 8: §8 Template & Theme System

**Sources of truth:**
- `clicker-platform-v2/lib/templates/definitions.ts` (6 templates)
- `clicker-platform-v2/lib/templates/registry.ts` (registry shape)
- `clicker-platform-v2/lib/templates/types.ts` (TemplateConfig type)
- `clicker-platform-v2/components/headers/` listing

**What to write:**

- **6 templates table** (not 5): classic, modern, sojourner, shuvo, mrb, mrb-light — with style/cardStyle/layout columns matching the current doc table but verified against `definitions.ts`.
- Template files structure — same as old doc.
- TemplateConfig shape — copy from `types.ts`, not memory.
- Header components (only 4 files exist: ClassicProfileHeader, ModernProfileHeader, MrbHeader, ShuvoHeader). Document which templates reuse which header (sojourner and mrb-light likely share a default — confirm in `registry.ts`).
- MRB block overrides (MrbHero, MrbQuickActions, MrbOperatingHours) — verify against `components/blocks/mrb/` listing.
- Content-showcase block has a similar structure (`components/blocks/content-showcase/`) — mention as another template-aware block.

- [ ] **Step 1: Read `lib/templates/definitions.ts`, `lib/templates/registry.ts`, `lib/templates/types.ts`**
- [ ] **Step 2: Run `ls clicker-platform-v2/components/blocks/mrb/` and `components/blocks/content-showcase/`**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §8 template & theme system (6 templates)"
```

---

## Task 9: §9 Block System (Canvas Studio)

**Sources of truth:**
- `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts` (BLOCK_OPTIONS — 18 types)
- `clicker-platform-v2/components/blocks/public/` (renderer files)
- `clicker-platform-v2/components/blocks/BlockRenderer.tsx` (override chain)

**What to write:**

- **18 block types table** (not 14): hero, text, content_showcase, image, button, products, faq, link, map, image_gallery, social_embed, quick_actions, hours, featured_product, branches, inline_form, heading, feature_cards. One-line description each.
- Note: `DefaultProductGalleryBlock.tsx` exists as a renderer but no matching `BLOCK_OPTIONS` entry — flag as either deprecated or unlisted. Mark `[VERIFY]` if can't determine.
- Canvas Studio file layout — keep current.
- Block rendering (public site) file structure — keep current, update with `content-showcase/`, `feature-cards/`, `mrb/`, `shared/` subdirs.
- Override chain: template registry → module registry → default renderer. Cite `BlockRenderer.tsx`.

- [ ] **Step 1: Read `blockDefinitions.ts` to confirm all 18 entries**
- [ ] **Step 2: Read `BlockRenderer.tsx` to confirm override chain order**
- [ ] **Step 3: Investigate DefaultProductGalleryBlock — is it referenced from anywhere?**
- [ ] **Step 4: Write the section**
- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §9 block system with 18 block types"
```

---

## PART III — CROSS-CUTTING SUBSYSTEMS

> Each subsystem section follows the same template:
> 1. **Purpose** (1 paragraph)
> 2. **File map** (table: file → responsibility)
> 3. **Public API** (the functions other code calls)
> 4. **Data flow / lifecycle** (where applicable)
> 5. **DB paths** (where applicable)
> 6. **Integration points** (which modules consume it)

## Task 10: §10 AI Platform & Kredit

**Sources of truth:**
- `clicker-platform-v2/lib/ai/` (all files: client.ts, credits.ts, models.ts, pricing.ts, context.ts, types.ts, index.ts)
- `app/api/admin/ai-credits/`, `app/api/admin/ai-usage/`
- Memory: "AI Boosters Initiative" — daily usage aggregation pattern

**What to write:**

- Purpose: Gemini API integration, model selection, Kredit accounting (daily aggregate + topup-only log).
- File map: every file in `lib/ai/` with one-line purpose.
- Public API: list exported functions from `lib/ai/index.ts` (signatures + when to use).
- Pricing: cite `pricing.ts` for current per-model rates.
- DB paths: `sites/{siteId}/aiUsage/{day}` aggregate, `sites/{siteId}/aiUsage/topups` log (verify against actual constants).
- Integration: ai-sales, ai-marketing, stocklens (knowledge sync).
- API endpoints: `/api/admin/ai-credits`, `/api/admin/ai-usage`.

- [ ] **Step 1: Read all files in `lib/ai/` to extract real signatures and DB paths**
- [ ] **Step 2: Read `app/api/admin/ai-credits/route.ts` and `app/api/admin/ai-usage/route.ts`**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §10 AI platform & Kredit system"
```

---

## Task 11: §11 Email (Resend)

**Sources of truth:**
- `clicker-platform-v2/lib/email/` (config.ts, context.ts, guard.ts, index.ts, log.ts, sender.ts, types.ts)
- Memory: "Resend Email Foundation — Implemented & Ratified"

**What to write:**

- Purpose: transactional email via Resend, hosted templates (NOT React Email), per-site sender identity.
- File map.
- Public API: `sendEmail({ siteId, to, templateAlias, variables })` — the only call site for app code. Cite `sender.ts`.
- Guard rules: what `guard.ts` prevents (rate-limit? unsubscribed users? confirm against source).
- Logging: `log.ts` writes to `emailLog/{id}` — confirm path against source.
- Where else: also used by `auth-gateway/` and `functions/` (cross-app — keep summary, cite ARCHITECTURE.md as the source of truth for the API contract).

- [ ] **Step 1: Read every file in `lib/email/`**
- [ ] **Step 2: Write the section, grounding every function signature in the source**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §11 email (Resend) subsystem"
```

---

## Task 12: §12 Analytics (PostHog)

**Sources of truth:**
- `clicker-platform-v2/lib/analytics/PostHogProvider.tsx`
- `clicker-platform-v2/lib/analytics/useAnalytics.ts`
- `app/api/analytics/track/route.ts`
- Memory: "PostHog Integration — Implemented (verification pending)"

**What to write:**

- Purpose: product analytics via PostHog, siteId is a super-property (every event tagged).
- File map.
- Provider mount point: confirm where `<PostHogProvider>` is wrapped (likely root layout).
- `useAnalytics()` hook signature.
- Server-side tracking: `/api/analytics/track` endpoint (when used).
- Events catalogue: list known events (7 events across 6 modules per memory) — extract from grep `posthog.capture\|trackEvent` across codebase.

- [ ] **Step 1: Read PostHogProvider.tsx and useAnalytics.ts**
- [ ] **Step 2: Run `grep -rn "useAnalytics\|posthog.capture" clicker-platform-v2/` to enumerate events**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §12 analytics (PostHog) subsystem"
```

---

## Task 13: §13 WhatsApp Integration

**Sources of truth:**
- `clicker-platform-v2/lib/whatsapp/` (constants.ts, contact-classifier.ts, encryption.ts, gateway.ts, message-router.ts, phone.ts, types.ts, webhook-processor.ts)
- `app/api/admin/whatsapp/` (connect, disconnect, send, test)
- `app/api/webhook/whatsapp/route.ts`
- `app/admin/(dashboard)/whatsapp/` (admin UI)

**What to write:**

- Purpose: WhatsApp Cloud API integration — outbound messaging, inbound webhook, owner commands, contact classification, module bridges (POS, Reservation, CRM, Service Records).
- File map (every file in `lib/whatsapp/`).
- Outbound flow: app code → `gateway.ts` (`MessagingGateway`) → WA Cloud API.
- Inbound flow: WA → `/api/webhook/whatsapp` → `webhook-processor.ts` → `message-router.ts` → module handler.
- Encryption: tokens stored encrypted via `encryption.ts` — cite the cipher used.
- Admin endpoints: connect (OAuth?), disconnect, send (test), test (sandbox).
- DB paths: where WA config and message log live.

- [ ] **Step 1: Read every file in `lib/whatsapp/`**
- [ ] **Step 2: Read the 4 admin API routes and the webhook route**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §13 WhatsApp integration"
```

---

## Task 14: §14 Registration Flow

**Sources of truth:**
- `clicker-platform-v2/lib/registration/` (api-server.ts, bundles.ts, constants.ts, event-log.ts, modules-catalog.ts, rate-limit.ts, schema.ts, slug.ts, submit-action.ts, types.ts)
- `clicker-platform-v2/app/register/`
- Memory: "Registration Flow — Spec & Plan Complete (not yet implemented)" — verify current state vs memory.

**What to write:**

- Purpose: public lead-capture flow at `clicker.id/register` with bundle/module picker + promo code.
- Current state: confirm whether implemented or still in plan stage (memory says plan exists but not implemented — verify by reading `submit-action.ts`).
- File map.
- Flow: form → `submit-action.ts` (server action) → `api-server.ts` → schema validation → slug generation → rate-limit check → event-log write → site doc creation.
- Bundles catalog: `bundles.ts` defines purchasable bundles.
- Modules catalog: `modules-catalog.ts` defines the menu of modules user can opt into.
- Rate-limit: `rate-limit.ts` uses Upstash Redis.

- [ ] **Step 1: Read all files in `lib/registration/` to determine actual implementation state**
- [ ] **Step 2: Read `app/register/page.tsx`**
- [ ] **Step 3: Write the section (mark `[STATUS: implemented]` or `[STATUS: scaffolded only]` accordingly)**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §14 registration flow"
```

---

## Task 15: §15 Promo Engine Facade

**Sources of truth:**
- `clicker-platform-v2/lib/modules/promo/api/` (claim.ts, commit.ts, discount.ts, evaluator.ts, promos.ts, settings.ts, vouchers.ts)
- `clicker-platform-v2/lib/modules/promo/constants.ts`
- `clicker-platform-v2/app/api/public/validate-promo/route.ts`

**What to write:**

- Purpose: discount/voucher/auto-apply rules, evaluated against cart context. Exported as a **facade** so other modules can import without violating module isolation.
- Why this exception exists: promos cut across POS, Reservation, Service Records — pulling promo logic into each module would duplicate evaluation rules.
- Public API (signatures from each file):
  - `evaluator.ts` — `evaluatePromo({ cart, code?, siteId })` returns discount preview
  - `commit.ts` — `commitPromoUsage()` writes redemption record
  - `claim.ts` — voucher claim
  - `discount.ts` — discount math helpers
  - `promos.ts`, `vouchers.ts`, `settings.ts` — CRUD
- DB paths: `modules/promo/promos`, `modules/promo/vouchers`, `modules/promo/settings/config`.
- Public endpoint: `/api/public/validate-promo` for unauthenticated cart-side validation.
- Integration: list which modules currently consume the facade (use grep).

- [ ] **Step 1: Read every file in `lib/modules/promo/api/`**
- [ ] **Step 2: Run `grep -rn "@/lib/modules/promo/api" clicker-platform-v2/` to enumerate consumers**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §15 promo engine facade"
```

---

## Task 16: §16 Core Business Primitives

**Sources of truth:**
- `clicker-platform-v2/lib/core/businessHours/`
- `clicker-platform-v2/lib/core/serviceCatalog/`
- `clicker-platform-v2/lib/core/types.ts`

**What to write:**

- Purpose: shared business primitives used across multiple modules (operating hours, service catalog).
- Why these are in `lib/core/` not a module: they're tenant-level data referenced by Reservation, POS open/close gating, Service Records, public site "Hours" block. Promoting to core avoids module-to-module imports.
- `businessHours/` — types + helpers (open-now check, next-open calculation).
- `serviceCatalog/` — types + helpers (catalog item shape, lookups).
- Consumers list.

- [ ] **Step 1: Read everything in `lib/core/`**
- [ ] **Step 2: Run `grep -rn "@/lib/core/businessHours\|@/lib/core/serviceCatalog" clicker-platform-v2/` to enumerate consumers**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §16 core business primitives"
```

---

## Task 17: §17 Storage & Upload

**Sources of truth:**
- `clicker-platform-v2/lib/upload.ts`
- `clicker-platform-v2/lib/imageUtils.ts`
- `clicker-platform-v2/lib/media/recommendations.ts`
- `clicker-platform-v2/app/api/upload/avatar/` and `app/api/upload/image/`
- `clicker-platform-v2/storage.rules`

**What to write:**

- Purpose: file/image uploads to Firebase Storage with server-side validation, resizing (sharp), and tenant-scoped paths.
- Public client API: `uploadToStorage()`, `uploadAvatar()`, etc. — extract from `upload.ts`.
- Server-side: upload routes (`/api/upload/avatar`, `/api/upload/image`) handle validation, sharp resizing, write to storage, return URL.
- Image utilities: `imageUtils.ts` for client-side preview/compression.
- Media recommendations: `media/recommendations.ts` (sizing recommendations? Verify.).
- Storage rules summary: how `storage.rules` enforces tenant isolation.

- [ ] **Step 1: Read `lib/upload.ts`, `lib/imageUtils.ts`, `lib/media/recommendations.ts`**
- [ ] **Step 2: Read upload API routes and `storage.rules`**
- [ ] **Step 3: Write the section**
- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §17 storage & upload"
```

---

## PART IV — CONVENTIONS & REFERENCES

## Task 18: §18 Global Contexts

**Sources of truth:**
- `clicker-platform-v2/lib/site-context.tsx`
- `clicker-platform-v2/lib/user-context.tsx`
- `clicker-platform-v2/lib/use-admin-theme.tsx`
- `clicker-platform-v2/lib/inbox-panel-context.tsx`
- `clicker-platform-v2/lib/top-bar-slot-context.tsx`

**What to write:**

- `useSite()` — properties (`siteId, tenantSlug, isPending, isSubdomain`) **plus the `setSiteId()` setter** used by TokenBootstrap.
- `useUser()` — properties (`user, role, isOwner, hasAccess, canEdit, getAccessLevel`).
- `useAdminTheme()` — light/dark toggle.
- `useInboxPanel()` — global inbox panel state (new section).
- `useTopBarSlot()` — admin top-bar slot injection (new section).

- [ ] **Step 1: Read each context file to confirm exports**
- [ ] **Step 2: Write the section**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §18 global contexts (all 5)"
```

---

## Task 19: §19 Database Paths

**Sources of truth:**
- All `lib/modules/{module}/constants.ts` files
- `lib/registration/constants.ts`
- `lib/email/` for emailLog path
- `lib/ai/` for aiUsage path
- `firestore.rules` for path patterns

**What to write:**

- **Core data table** — add: registration leads, aiUsage/{day}, aiUsage/topups, emailLog, warrantyCards, reminderQueue.
- **Module data table — 11 module entries:** byod_pos, membership, inventory, stocklens, reservation, sales_pipeline, service_records (multi-collection), fintrack (8 collections), promo (3 collections), ai_marketing (5 collections), ai_sales.
- Module path pattern: `sites/{siteId}/modules/{module_id}/{collection}`.
- **Exceptions:** sales_pipeline leads at `sites/{siteId}/leads/{leadId}` (top-level), `modules/sales_pipeline/settings/config` for config. Document why.
- Global module registry: `modules/{module_id}` (not per-tenant).
- Rule: paths MUST be defined as constants in `lib/modules/{module}/constants.ts`.

- [ ] **Step 1: Run `cat clicker-platform-v2/lib/modules/*/constants.ts` to extract every path constant**
- [ ] **Step 2: Compile the table**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §19 database paths (full inventory)"
```

---

## Task 20: §20 API Routes

**Sources of truth:**
- `find clicker-platform-v2/app/api -type d`
- Inspect each route's `route.ts` for method + auth requirement

**What to write:**

Full tree (39+ routes). Organize by category:

- **Admin (authenticated):**
  - `admin/ai/credits`, `admin/ai-credits`, `admin/ai-usage`
  - `admin/cache/purge`
  - `admin/knowledge/sync`, `admin/knowledge/verify`
  - `admin/modules/ai-marketing/{assets/upload,assets/analyze,campaigns,campaigns/[id],config,export,generate,saved}`
  - `admin/modules/ai-sales-agent/config`
  - `admin/seed-templates`
  - `admin/team/{add,remove}`
  - `admin/whatsapp/{connect,disconnect,send,test}`
- **Public:**
  - `ai-sales-agent/chat`
  - `public/validate-promo`
  - `warranty/[warrantyCode]/pdf`
- **Forms & submissions:**
  - `forms/{create,delete,submit,update}`, `submissions/update`
- **Uploads:**
  - `upload/{avatar,image}`
- **Auth:**
  - `auth/check-access`
- **Webhooks:**
  - `webhook/whatsapp`
- **Stocklens module routes:**
  - `stocklens/{check-sku,scan,settings,test-key}`
- **Infrastructure:**
  - `analytics/track`
  - `log/client-error`
  - `proxy/lottie`
  - `debug-firebase` (debug only)

Server vs client SDK rule: keep current.

- [ ] **Step 1: Run `find clicker-platform-v2/app/api -name 'route.ts' | head -50` and read first lines of each**
- [ ] **Step 2: Write the section**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §20 API routes (full inventory)"
```

---

## Task 21: §21 Admin UI Conventions

**Sources of truth:**
- Existing §12 content (keep)
- `clicker-platform-v2/lib/use-admin-theme.tsx`
- Sample dark-mode-aware admin component (grep for `dark:` class usage)

**What to write:**

- Keep all current snippets (card, input, button, badge, anti-patterns).
- **Add: Dark mode conventions** — when to use `useAdminTheme()`, the `dark:` Tailwind prefix pattern, how to test both themes, common pitfalls (e.g. hardcoded `bg-white` without `dark:bg-gray-900`).

- [ ] **Step 1: Read `lib/use-admin-theme.tsx` and one dark-mode-aware admin page**
- [ ] **Step 2: Write the section**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §21 admin UI conventions with dark mode"
```

---

## Task 22: §22 Key File Index

**Sources of truth:**
- Whatever has been cited in §1–§21

**What to write:**

A flat table of every architecturally significant file with one-line role. Sourced from the files cited in earlier tasks. Add:

- `lib/ai/{client,credits,models,pricing}.ts`
- `lib/email/{sender,guard,log}.ts`
- `lib/analytics/PostHogProvider.tsx`, `lib/analytics/useAnalytics.ts`
- `lib/whatsapp/{gateway,webhook-processor,message-router}.ts`
- `lib/registration/{submit-action,api-server,schema}.ts`
- `lib/core/{businessHours,serviceCatalog}/index.ts`
- `lib/{admin-auth,api-auth,sanitizeHtml,logger,logger-edge,upload,imageUtils}.ts`
- `lib/{inbox-panel-context,top-bar-slot-context}.tsx`
- `components/admin/TokenBootstrap.tsx`
- Fix existing "5 template configs" stale claim → 6.

- [ ] **Step 1: Walk back through prior task sources and compile the full list**
- [ ] **Step 2: Write the table**
- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §22 key file index"
```

---

## Task 23: §23 Data Flow Diagrams

**Sources of truth:**
- Existing §14 diagrams (keep all three)

**What to write:**

Keep the three current diagrams (public page render, admin module route, module enable check). **Add two new diagrams:**

1. **Auth handoff** (gateway → platform via custom token in URL fragment) — already textually documented in §4, but a diagram helps.
2. **AI request lifecycle** (caller → `lib/ai/client` → Gemini → usage write → response) — short.

- [ ] **Step 1: Write the section**
- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §23 data flow diagrams (+ auth + AI flows)"
```

---

## Task 24: §24 Appendices

**Sources of truth:**
- Existing checklists (keep)

**What to write:**

Keep both checklists from current doc:
- **Adding a New Module** — update with the 5th file (`client-registry.tsx`), and add a step: "If your module needs cross-module access, document whether to use `isModuleEnabled()` or add a sanctioned facade exception in §6."
- **Adding a New Template** — keep as-is.

Also add:
- **Adding a New Cross-Cutting Subsystem** checklist — for the Part III pattern (when something is too foundational to be a module but isn't core):
  1. Create `lib/{subsystem}/` directory
  2. Define a single public API surface (`index.ts`)
  3. Document in a new Part III section in this doc
  4. Add file index entries
  5. Add DB paths to §19 if introducing new collections
  6. Add API routes to §20 if introducing new endpoints

- [ ] **Step 1: Write the section**
- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md
git commit -m "docs(architecture): §24 appendices with cross-cutting subsystem checklist"
```

---

## Task 25: Update CLAUDE.md to defer to ARCHITECTURE.md

**Files:**
- Modify: `dev/CLAUDE.md`

**What to write:**

- Add a preamble at the very top of the **"Auth Gateway — Flow & Rules"** section:

```markdown
## Auth Gateway — Flow & Rules

> **Source of truth:** Full canonical flow is documented in [`clicker-platform-v2/docs/ARCHITECTURE.md` §4 Authentication & Session Handoff](clicker-platform-v2/docs/ARCHITECTURE.md#4-authentication--session-handoff). The summary below is a quick reference for Claude Code sessions. If it conflicts with ARCHITECTURE.md, **ARCHITECTURE.md wins**.
```

- Replace the 7-step flow block with a condensed 3-line summary:

```markdown
**Quick reference (full version in ARCHITECTURE.md §4):**
- Gateway (`auth.clicker.id` / port 3012) authenticates → mints custom token → redirects to `{slug}.clicker.id/admin#token=...&siteId=...`
- Platform's `TokenBootstrap.tsx` reads URL fragment → sets `__session` cookie + `__token_bootstrapping` sessionStorage flag → `signInWithCustomToken()` → `setSiteId()`
- `UserProvider` resolves member doc → `AdminGuard` renders dashboard
```

- Keep the **file tables** (penting auth-gateway / platform files) — they're useful as a Claude-quick-glance even if duplicated.
- Keep the **Rules** block.
- Add at the top of the entire CLAUDE.md (right after the existing intro line):

```markdown
> **For platform architecture details:** [`clicker-platform-v2/docs/ARCHITECTURE.md`](clicker-platform-v2/docs/ARCHITECTURE.md) is the source of truth. CLAUDE.md is a quick-reference for Claude Code sessions; conflicts resolve to ARCHITECTURE.md.
```

- [ ] **Step 1: Read current CLAUDE.md auth section to know exactly what to replace**
- [ ] **Step 2: Make the three edits above**
- [ ] **Step 3: Commit**

```bash
git add dev/CLAUDE.md
git commit -m "docs(claude): defer to ARCHITECTURE.md as source of truth"
```

---

## Task 26: Final pass — link check, TOC verify, delete backup

**Files:**
- Modify: `clicker-platform-v2/docs/ARCHITECTURE.md`
- Delete: `clicker-platform-v2/docs/ARCHITECTURE.old.md`

- [ ] **Step 1: Verify every TOC anchor link resolves to a section heading (read full doc end-to-end)**
- [ ] **Step 2: Verify every relative file path in the doc exists on disk (grep doc for `clicker-platform-v2/` and `lib/` paths, then `ls` each one)**
- [ ] **Step 3: Resolve any `[VERIFY]` markers left from earlier tasks — either confirm against source or remove the claim**
- [ ] **Step 4: Update `Last updated:` header to today's date**
- [ ] **Step 5: Delete the backup**

```bash
rm clicker-platform-v2/docs/ARCHITECTURE.old.md
```

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/docs/ARCHITECTURE.md clicker-platform-v2/docs/ARCHITECTURE.old.md
git commit -m "docs(architecture): final link check, remove backup"
```

---

## Self-Review Checklist (run after writing the plan, before handing off)

**Spec coverage:** every gap from the audit report is addressed:
- 🔴 Module count 8 → 12 → Task 7
- 🔴 Template count 5 vs 6 contradiction → Task 1 + 8
- 🔴 Block count 14 → 18 → Task 9
- 🔴 Special routes list incomplete → Task 3
- 🔴 WhatsApp webhook path wrong → Task 13 + 20
- 🔴 RBAC roles incomplete (2 → 4) → Task 5
- 🔴 byod_pos route labels drifted → Task 7
- 🟢 AI Platform → Task 10
- 🟢 Email → Task 11
- 🟢 Analytics → Task 12
- 🟢 WhatsApp → Task 13
- 🟢 Registration → Task 14
- 🟢 Promo facade → Task 15
- 🟢 Core primitives → Task 16
- 🟢 Storage/Upload → Task 17
- 🟢 New contexts (inbox, topbar) → Task 18
- 🟢 TokenBootstrap auth flow → Task 4
- 🟡 Stale lib/ inventory → Task 2
- 🟡 Stale API routes → Task 20
- 🟡 Stale key file index → Task 22
- 🟡 Missing facade exception note → Task 6

**Placeholder scan:** No "TBD", "TODO", or "fill in details" left in plan. Each task names exact files to read and exact content to write.

**Type consistency:** Filenames are cited consistently across tasks; module IDs use the canonical underscore form (`byod_pos`, `ai_sales`, `service_records`); subsystem names match between §-references (e.g., "AI Platform & Kredit" used in §10, §22, §23, §24).

---

## Execution Notes

This plan is 26 tasks but each is small (one section, 10–60 minutes including verification). Most likely subagent-driven execution is overkill for doc work — recommend **inline execution** so the user can sanity-check each section as it lands.

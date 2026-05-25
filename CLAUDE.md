# CLAUDE.md — Clicker Universe

Project instructions for Claude Code. Read `AGENTS.md` for the full architecture reference.

> **For platform architecture details:** [`clicker-platform-v2/docs/ARCHITECTURE.md`](clicker-platform-v2/docs/ARCHITECTURE.md) is the **source of truth**. CLAUDE.md is a quick reference for Claude Code sessions; if anything here conflicts with ARCHITECTURE.md, **ARCHITECTURE.md wins**.

---

## Quick Start

```bash
cd clicker-platform-v2
pnpm dev        # Start dev server on port 3000
pnpm test       # Run Vitest
pnpm lint       # ESLint
pnpm build      # Production build
```

## Static Analysis (Semgrep)

Run from repo root. CI runs the same rule set on PRs to `main` and on merges.

```bash
make semgrep-install   # one-time: brew install semgrep
make semgrep           # full scan (community rule packs)
make semgrep-secrets   # separate sweep for leaked secrets
make semgrep-sarif     # emit semgrep.sarif for IDE viewers
```

Rule packs are pinned in the `Makefile` (`SEMGREP_CONFIGS`) and must match `.github/workflows/semgrep.yml` so local and CI behave identically. Path exclusions live in `.semgrepignore`.

## Critical Rules

1. **Core vs Module boundary** — modules cannot import from each other directly.
2. **Server/Client split** — `firebase-admin` is server-only. Client components use the Firebase client SDK.
3. **Multi-tenancy** — always use `siteId` from `useSite()`. Never hardcode tenant IDs.
4. **RBAC guard** — check `canEdit()` before every write in client components.
5. **DB paths** — use constants from `lib/modules/{name}/constants.ts`, never raw strings.
6. **Cross-module promo imports** — modules may import from `@/lib/modules/promo/api` (the facade only). Designated exception to rule 1, same as `@/lib/modules/membership/api`.
7. **New module = seed global registry** — adding a module requires a Firestore doc at `modules/{id}` with at least `{ id, displayName, enabled: true, icon, version }`. Without it, Backyard's per-tenant toggle silently fails: `sites/{id}.modules.{moduleId} = true` is written, but the module never renders in sidebar/Overview because `subscribeToEnabledModules` queries `modules` WHERE `enabled == true`. Run `pnpm tsx scripts/seed-modules.ts` (or insert via MCP) when introducing a new module. Module IDs use **underscore** (`promo`, `ai_marketing`, `sales_pipeline`), not dash.
8. **Destructive actions use `<ConfirmButton>`** — never `window.confirm()` or a bare red button that fires immediately. Use [`components/ui/ConfirmButton.tsx`](clicker-platform-v2/components/ui/ConfirmButton.tsx); it inlines a soft-red Confirm / Cancel pair on first click. ESLint will reject `window.confirm` / `confirm()` calls.
9. **Match existing modules before writing new ones** — before writing any file in `lib/modules/*/admin/` (or any new module folder), open at least one existing module's equivalent file as a reference and match its conventions: layout, page wrapper, buttons, colors, forms, tables, empty states, top-bar reliance, dark-mode classes. Canonical references: `lib/modules/promo/components/PromoListPage.tsx` (list page), `lib/modules/promo/admin/SettingsPage.tsx` (settings), `lib/modules/byod_pos/admin/` (forms). Do **not** infer styling from spec snippets or from one outdated module — the platform's working code is the source of truth.
10. **The `membership` module is LOYALTY ONLY** — name is historically misleading (should have been `loyalty`; rename deferred). Its **only** legitimate concern is points, tiers, spend tracking. The `/member/login` route happens to live in its code by accident — **do not** treat that as authoritative. **No new module may depend on `membership` for identity or login.** Firebase Auth is the platform-level primitive; any module that needs an authenticated buyer/user owns its own login route under its own namespace (e.g. `digital_goods` owns `/store/login`). The membership module is touched only by an optional integration like `addPoints` on a paid order. **If a task plan tells you to redirect a new module's login to `/member/login`, the plan is wrong** — flag it and build the module-owned route instead.

## Skills Available

This project has Claude Code skills in `.claude/commands/`. Use them:

### Core Architecture
- `/clicker_platform_core` — architecture rules, module registration checklist, 3-way parity rule
- `/module` — scaffold or audit a module
- `/backyard` — superadmin God Mode dashboard (port 3011, all-client, Cloud Functions only)

### Platform Modules
- `/byod_pos` — Self Order POS (cashier, KDS, transactions, menu, reports)
- `/inventory` — stock management, audit trails
- `/reservation` — booking & scheduling
- `/membership` — loyalty program, member profiles
- `/promo` — promo engine, discount codes, vouchers, auto-apply rules
- `/promo_integration` — step-by-step guide to add promo support to any billing module
- `/sales_pipeline` — CRM Kanban board
- `/service_records` — vehicle service records, warranty, reminders
- `/ai_sales_agent` — Gemini AI chatbot, lead capture
- `/fintrack` — personal finance tracker (wallets, entries, debts, budget, recurring)

### Core Features
- `/core_auth_rbac` — authentication and RBAC
- `/core_appearance` — themes and templates
- `/core_business` — business profile, settings
- `/core_content` — pages, links, system blocks
- `/core_crm` — forms and inbox
- `/canvas_studio` — WYSIWYG page builder
- `/font_pack` — Font Pack system & Site Styles → Fonts picker
- `/admin_dark_theme` — dark theme system
- `/file_upload` — file and image uploads

### Templates & UI
- `/template` — scaffold or audit a template
- `/create_template` — architect a new template/theme
- `/template_mrb` — MRB "Mr Brightside" dark glassmorphism template
- `/block_builder` — advanced block builder

See `.agents/README.md` for the full skill index.

## Superpowers Output Convention

Always save skill outputs to the appropriate folder under `superpowers/`:

| Activity               | Save to                                              |
| ---------------------- | ---------------------------------------------------- |
| Brainstorming sessions | `superpowers/brainstorm/YYYY-MM-DD-topic.md`         |
| Feature specs          | `superpowers/specs/YYYY-MM-DD-topic.md`              |
| Implementation plans   | `superpowers/plans/YYYY-MM-DD-topic.md`              |
| Audit & research notes | `superpowers/notes/YYYY-MM-DD-topic.md`              |

Use today's date and a short kebab-case topic name for the filename.
## Auth Gateway — Flow & Rules

> **Source of truth:** Full canonical flow is documented in [`clicker-platform-v2/docs/ARCHITECTURE.md` §4 Authentication & Session Handoff](clicker-platform-v2/docs/ARCHITECTURE.md#4-authentication--session-handoff). The summary below is a quick reference for Claude Code sessions. If it conflicts with ARCHITECTURE.md, **ARCHITECTURE.md wins**.

Gateway (`auth-gateway/`, port **3012**) adalah thin auth layer. Tugasnya hanya autentikasi, bukan tenant logic.

**Quick reference (full version in ARCHITECTURE.md §4):**

- Gateway (`auth.clicker.id` / port 3012) authenticates → mints custom token via `/api/token` (Firebase Admin) → redirects to `{slug}.clicker.id/admin#token=...&siteId=...` (token in URL fragment, not query).
- Platform's `TokenBootstrap.tsx` reads the fragment, sets `__session` cookie + `__token_bootstrapping` sessionStorage flag, calls `setSiteId()`, then `signInWithCustomToken()`.
- `UserProvider` resolves `sites/{siteId}/members/{uid}` → role; `AdminGuard` renders dashboard.
- Subsequent visits: cookie + IndexedDB session bypass the gateway entirely.

**File penting auth-gateway:**
| File | Fungsi |
|------|--------|
| `app/page.tsx` | Login form + performHandoff |
| `app/api/token/route.ts` | Buat custom token (Firebase Admin, no CF) |
| `lib/firebase-admin.ts` | Init Firebase Admin dengan service account |
| `lib/get-user-sites.ts` | Resolve tenant (ownerId ∥ ownerEmail → members) |
| `.env.development.local` | `GCP_SERVICE_ACCOUNT_KEY`, `NEXT_PUBLIC_AUTH_GATEWAY_URL` |

**File penting platform (auth):**
| File | Fungsi |
|------|--------|
| `components/admin/TokenBootstrap.tsx` | Process `#token` dari gateway, set cookie + siteId |
| `lib/site-context.tsx` | `setSiteId()` untuk client-side override tanpa reload |
| `lib/user-context.tsx` | Guard `__token_bootstrapping` sessionStorage flag |
| `middleware.ts` | Skip `__session` check di localhost (`isLocal`) |

**Rules:**
- Gateway TIDAK boleh tahu detail tenant — hanya resolve siteId minimal untuk cookie
- Jangan tambah logika bisnis ke gateway
- `generateHandoffToken` Cloud Function sudah digantikan `/api/token` route — jangan pakai CF lagi

## File Navigation

- Main platform: `clicker-platform-v2/`
- Auth service: `auth-gateway/` (port 3012)
- Super-admin: `backyard/`
- Firebase functions: `functions/`
- Architecture docs: `clicker-platform-v2/docs/ARCHITECTURE.md` ← single source of truth

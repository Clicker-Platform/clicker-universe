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

## Critical Rules

1. **Core vs Module boundary** — modules cannot import from each other directly.
2. **Server/Client split** — `firebase-admin` is server-only. Client components use the Firebase client SDK.
3. **Multi-tenancy** — always use `siteId` from `useSite()`. Never hardcode tenant IDs.
4. **RBAC guard** — check `canEdit()` before every write in client components.
5. **DB paths** — use constants from `lib/modules/{name}/constants.ts`, never raw strings.
6. **Cross-module promo imports** — modules may import from `@/lib/modules/promo/api` (the facade only). Designated exception to rule 1, same as `@/lib/modules/membership/api`.

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

### Core Features
- `/core_auth_rbac` — authentication and RBAC
- `/core_appearance` — themes and templates
- `/core_business` — business profile, settings
- `/core_content` — pages, links, system blocks
- `/core_crm` — forms and inbox
- `/canvas_studio` — WYSIWYG page builder
- `/admin_dark_theme` — dark theme system
- `/file_upload` — file and image uploads

### Templates & UI
- `/template` — scaffold or audit a template
- `/create_template` — architect a new template/theme
- `/template_mrb` — MRB "Mr Brightside" dark glassmorphism template
- `/block_builder` — advanced block builder

See `.agents/README.md` for the full skill index.

## Superpowers Output Convention

Always save skill outputs to the appropriate folder under `dev/superpowers/`:

| Activity               | Save to                                                      |
| ---------------------- | ------------------------------------------------------------ |
| Brainstorming sessions | `dev/superpowers/brainstorm/YYYY-MM-DD-topic.md`             |
| Feature specs          | `dev/superpowers/specs/YYYY-MM-DD-topic.md`                  |
| Implementation plans   | `dev/superpowers/plans/YYYY-MM-DD-topic.md`                  |
| Audit & research notes | `dev/superpowers/notes/YYYY-MM-DD-topic.md`                  |

Full path dari repo root: `/Users/andre/Repository/clicker-universe/dev/superpowers/`

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

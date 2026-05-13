# CLAUDE.md — Clicker Universe

Project instructions for Claude Code. Read `AGENTS.md` for the full architecture reference.

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
7. **New module = seed global registry** — adding a module requires a Firestore doc at `modules/{id}` with at least `{ id, displayName, enabled: true, icon, version }`. Without it, Backyard's per-tenant toggle silently fails: `sites/{id}.modules.{moduleId} = true` is written, but the module never renders in sidebar/Overview because `subscribeToEnabledModules` queries `modules` WHERE `enabled == true`. Run `pnpm tsx scripts/seed-modules.ts` (or insert via MCP) when introducing a new module. Module IDs use **underscore** (`promo`, `ai_marketing`, `sales_pipeline`), not dash.

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

Gateway (`auth-gateway/`, port **3012**) adalah thin auth layer. Tugasnya hanya autentikasi, bukan tenant logic.

**Login flow — step by step:**

```
[1] User buka auth-gateway (localhost:3012 / auth.clicker.id)
    └─ Isi email + password → klik Enter Dashboard

[2] Gateway: signInWithEmailAndPassword(email, password)
    └─ Firebase Auth verify credential

[3] Gateway: parallel fetch
    ├─ getUserSites(uid, email) → Firestore: cari site milik user
    └─ POST /api/token { uid } → Firebase Admin createCustomToken(uid)

[4] Gateway: redirect browser ke platform
    └─ http://slug.clicker.id/admin#token=CUSTOM_TOKEN&siteId=SITE_ID
       (token di URL fragment — tidak masuk server log)

[5] Platform: layout.tsx render → TokenBootstrap useEffect jalan
    ├─ Baca #token + #siteId dari URL hash
    ├─ Set sessionStorage.__token_bootstrapping = '1'  (cegah AdminGuard redirect)
    ├─ Set __session=SITE_ID cookie (di platform origin)
    ├─ setSiteId(SITE_ID) → update SiteContext tanpa reload halaman
    └─ signInWithCustomToken(auth, token) → Firebase client SDK

[6] Platform: onAuthStateChanged → UserProvider
    ├─ Remove sessionStorage flag
    └─ Query Firestore: sites/{siteId}/members/{uid} → dapat role

[7] AdminGuard: user ada + role ada → render dashboard ✓

--- Subsequent visits (sudah login) ---
[A] Browser → platform/admin (cookie __session masih ada)
[B] Middleware: baca __session → inject x-site-id header
[C] Firebase cached session di IndexedDB → onAuthStateChanged(user) langsung
[D] Dashboard tanpa redirect ke gateway ✓
```

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
- Architecture docs: `clicker-platform-v2/Docs/ARCHITECTURE.md`

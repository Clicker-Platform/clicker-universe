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

Always save skill outputs to the appropriate folder under `superpowers/`:

| Activity               | Save to                                        |
| ---------------------- | ---------------------------------------------- |
| Brainstorming sessions | `superpowers/brainstorm/YYYY-MM-DD-topic.md`   |
| Feature specs          | `superpowers/specs/YYYY-MM-DD-topic.md`        |
| Implementation plans   | `superpowers/plans/YYYY-MM-DD-topic.md`        |
| Audit & research notes | `superpowers/notes/YYYY-MM-DD-topic.md`        |

Use today's date and a short kebab-case topic name for the filename.

## File Navigation

- Main platform: `clicker-platform-v2/`
- Auth service: `auth-gateway/`
- Super-admin: `backyard/`
- Firebase functions: `functions/`
- Architecture docs: `clicker-platform-v2/Docs/ARCHITECTURE.md`

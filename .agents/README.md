# .agents/

Organized AI assets for the Clicker Universe monorepo.

## Structure

```
.agents/
├── README.md       ← This file
└── skills/         ← Reusable agent skills (see .claude/commands/ for Claude skills)
```

## Claude Code Skills

All skills live in [`.claude/commands/`](../.claude/commands/). Each subdirectory is a skill with a `SKILL.md` file.
Invoke with `/skill_name` in Claude Code, or they auto-trigger based on context.

---

### Core Architecture

| Skill | Description |
|-------|-------------|
| `clicker_platform_core` | Architecture rules, golden boundaries (Core vs Module), server/client split, RBAC patterns, DB path rules, UI conventions, and **Module Registration Checklist** (4-file parity rule) |
| `module` | Scaffold, audit, and manage Clicker Platform modules |
| `backyard` | Superadmin God Mode dashboard — tenant forge, identity management, module toggling, permission editor, hard delete, URL update. Standalone Next.js app on port 3011 |

---

### Platform Modules

| Skill | Description |
|-------|-------------|
| `byod_pos` | Self Order POS — cashier, KDS, transactions, menu manager, reports |
| `inventory` | Stock management, audit trails, POS integration |
| `reservation` | Booking & scheduling system |
| `membership` | Loyalty program, member profiles, points |
| `sales_pipeline` | CRM Kanban board for lead tracking |
| `service_records` | Vehicle service records, warranty cards, reminder engine |
| `ai_sales_agent` | Gemini AI chatbot, system prompts, lead capture flow |
| `pos_reporting` | POS reporting module (sales data, transaction history) |

---

### Core Features

| Skill | Description |
|-------|-------------|
| `core_auth_rbac` | Authentication, Role-Based Access Control (RBAC), site/user contexts |
| `core_appearance` | Appearance, Theme, and Template system |
| `core_business` | Business Profile, General Settings |
| `core_content` | Pages, Links, and System Blocks |
| `core_crm` | Forms and the Inbox |
| `canvas_studio` | WYSIWYG page builder for custom pages |
| `admin_dark_theme` | Admin Dashboard Dark Theme system |
| `file_upload` | File and image uploads |

---

### Templates & UI

| Skill | Description |
|-------|-------------|
| `template` | Scaffold, audit, and manage visual templates |
| `create_template` | Architect and implement a new Template/Theme for Canvas Studio |
| `template_mrb` | MRB "Mr Brightside" template — dark glassmorphism with neon orange accents |
| `block_builder` | Advanced Block Builder bridging into Canvas Studio |

---

### Utility & One-Shot Plans

| Skill | Description |
|-------|-------------|
| `fix-package-json-errors` | Diagnose and fix pnpm monorepo package.json / Firebase deployment failures |
| `agnostic_booking` | Adds `formConfig` to ReservationSettings and generic `assetId`/`assetModel` fields to Booking |
| `multi_item_deduction` | Adds `ConsumedItem` interface and `consumedItems` array to ServiceRecord; refactors stock deduction |
| `digital_vehicle_passport` | Updates Vehicle schema to `carCatalogId` FK; aligns both booking flows to structured vehicle registration |

---

## Parity Rule (Critical)

When any module route changes, **three files must always be updated together**:

1. `clicker-platform-v2/lib/modules/definitions.ts` — platform source of truth
2. `backyard/lib/modules/definitions.ts` — must match platform (+ `displayName`, `description`, `SYSTEM_MODULES`)
3. `clicker-platform-v2/scripts/seed-modules.ts` — what gets written to production Firestore

Use `/clicker_platform_core` for the full checklist.

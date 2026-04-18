# Changelog — Clicker Universe

All notable changes to the Clicker Universe monorepo are documented here.  
For detailed per-app changelogs see [`clicker-platform-v2/CHANGELOG.md`](clicker-platform-v2/CHANGELOG.md).

---

## [Unreleased]

---

## [2026-04-18] — WhatsApp Core Integration (Phase 0–2)

### Added — `dev-whatsapp` branch

#### Phase 0 — Foundation
- `lib/whatsapp/types.ts` — Core types: `WAConfig`, `WAMessage`, `WAThread`, `WAContact`, `OutboundMessage`, `MetaWebhookPayload` and all Meta API payload interfaces
- `lib/whatsapp/constants.ts` — Firestore path constants (`WA_CONFIG_PATH`, `WA_CUSTOMER_THREADS_PATH`, etc.) + Meta API base URL
- `lib/whatsapp/contact-classifier.ts` — Actor classification engine: owner → staff → known contact → unknown, based on Firestore config + contacts collection
- `lib/whatsapp/gateway.ts` — `MessagingGateway` interface + `WhatsAppGateway` implementation with customer-send safeguard (`human_triggered: true` required)
- `lib/whatsapp/webhook-processor.ts` — Raw message storage → actor classify → route to `customer_threads` or `staff_commands`
- `lib/whatsapp/message-router.ts` — Owner command engine with regex COMMAND_MAP
- `app/api/webhooks/wa/route.ts` — GET: Meta webhook challenge verify | POST: HMAC SHA-256 signature verify → process incoming messages, always returns 200

#### Phase 1 — Core Inbox (Admin UI)
- `components/admin/whatsapp/WASetupWizard.tsx` — 5-step self-service wizard to connect WA Business account (Meta credentials → webhook config)
- `components/admin/whatsapp/WAInbox.tsx` — Real-time customer thread list via `onSnapshot`, filter (all/open/resolved), search, unread badge
- `components/admin/whatsapp/WAConversation.tsx` — Chat thread view with outbound reply (Enter to send), read receipt, mark resolved/reopen
- `components/admin/whatsapp/WASettings.tsx` — Connection status, test connection, owner phone config, security info, disconnect
- `app/admin/(dashboard)/whatsapp/page.tsx` — Main page: shows setup wizard if not connected, otherwise split inbox+conversation layout (responsive mobile)
- `app/api/admin/whatsapp/connect/route.ts` — AES-256 encrypt access token + save config to Firestore
- `app/api/admin/whatsapp/send/route.ts` — Server-side decrypt token → send via Meta API → save outbound message to Firestore
- `app/api/admin/whatsapp/disconnect/route.ts` — Clear WA config (status → disconnected)
- `app/api/admin/whatsapp/test/route.ts` — Validate token against Meta Graph API
- `app/admin/(dashboard)/AdminSidebar.tsx` — Added `MessageCircle` WhatsApp entry to `allCoreItems[]`

#### Phase 2 — Owner Command Mode
- `lib/whatsapp/message-router.ts` — Wired all 4 command handlers to real module APIs:
  - `handleSalesReport` → `byod_pos/api-reports.ts` (`getDailyReport` + `generateReportSummary`) — returns total sales, order count, avg, payment breakdown
  - `handleStockQuery` → `inventory/api.ts` (`getInventory`) — shows low-stock items + top 5 highest stock
  - `handleBookingQuery` → `reservation/api.ts` (`getBookingsForDay`) — today's booking schedule with time + guest name
  - `handleMemberQuery` → `membership/api.ts` (`getPaginatedMembers` + `getMembershipSettings`) — total members, active count, per-tier breakdown
- WA markdown formatting in all responses (`*bold*`, `_italic_`)

#### Skills
- `.claude/commands/wa_integration/SKILL.md` — New skill covering all 5 phases, audit checklist, debug guide, integrate pattern, add-command guide
- Skill synced to both `dev-whatsapp` and `main` `.claude/commands/`

### Architecture Notes
- WA is **core infrastructure**, not a module — lives in `lib/whatsapp/` (not `lib/modules/`)
- Firestore root: `sites/{siteId}/wa/` — separate from `sites/{siteId}/modules/`
- Access token encrypted with AES-256-CBC using `WA_ENCRYPTION_KEY` env var — **add to `.env.local`**
- Customer-send safeguard enforced at `WhatsAppGateway.send()` level — `human_triggered: true` required

### Added
- `AGENTS.md` — Universal agent instructions for all AI tools
- `CLAUDE.md` — Claude Code project instructions
- `TECH-STACK.md` — Approved tech stack to prevent agent drift
- `ARCHITECTURE.md` — High-level monorepo architecture reference
- `CONVENTIONS.md` — Coding conventions and development guide
- `CONTRIBUTING.md` — Contributor guide
- `llms.txt` — LLM-friendly project description
- `.env.example` — Documents required environment variables
- `.editorconfig` — Editor consistency config
- `.gitattributes` — Line ending normalization and AI context control
- `.nvmrc` — Node 22 runtime pinning
- `Makefile` — Shorthand commands for dev, build, test, lint
- `vitest.config.ts` — Root-level test runner config
- `tsconfig.json` — Root TypeScript project references
- `eslint.config.mjs` — Root linter config
- `.prettierrc` — Formatter config
- `tests/` — Root test directory with fixtures
- `clicker-platform-v2/AGENTS.md` — Nested agent instructions for the main platform
- `.agents/` — Organized AI assets directory

---

## [2026-03-28] — Platform v2

See [`clicker-platform-v2/CHANGELOG.md`](clicker-platform-v2/CHANGELOG.md) for full details.

### Highlights
- DeviceView Context System for Canvas Studio device preview
- Warranty Card PDF generation via `@react-pdf/renderer`
- AI Sales Agent lazy loading with `ChatWidgetLoader`
- PageStudio Global Settings live refresh
- Server-side Reservation data hydration

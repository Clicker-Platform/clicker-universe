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

## 1. System Overview

The **Clicker Platform** is a multi-tenant SaaS where each tenant (a business) gets:

- A **public biolink/website** at `/{tenantSlug}` (path-based) or `{tenantSlug}.clicker.id` (subdomain).
- An **admin dashboard** at `/admin` (subdomain-enforced in production via auth gateway).
- A choice of **template/theme** from 6 prebuilt designs (see §8).
- A library of **opt-in modules** — 12 registered (POS, Membership, Inventory, Stocklens, Reservation, AI Sales, Sales Pipeline, Service Records, FinTrack, Promo, AI Marketing, plus the in-progress AI Platform module — see §7).

The platform is delivered as part of a small monorepo (`clicker-platform-v2/`) with two sibling apps for auth and superadmin and a Firebase Functions service. See §2 for the repo layout.

### Tech Stack

Versions reflect `clicker-platform-v2/package.json` as of 2026-05-14.

| Layer | Library | Version |
|---|---|---|
| Framework | Next.js | 16.1.6 (App Router, webpack build) |
| | React | 19.2.3 |
| | TypeScript | 5.x |
| | Node | 22 (pinned in `engines`) |
| Data | `firebase` (client SDK) | 12.7.0 |
| | `firebase-admin` (server SDK) | 13.6.0 |
| Styling | Tailwind CSS | v4 (+ `@tailwindcss/postcss`, `@tailwindcss/typography`) |
| UI primitives | `@dnd-kit/core`, `/sortable`, `/utilities` | drag & drop |
| | `lucide-react` | icons |
| | `sonner` | toasts |
| | `qrcode.react` | QR rendering |
| | `lottie-react` | animations |
| Content | `@tiptap/*` | v3 (rich text — core, react, starter-kit, image, link, placeholder) |
| | `isomorphic-dompurify` | HTML sanitization |
| AI | `@google/generative-ai` | 0.24.x (Gemini — see §10) |
| Analytics | `posthog-js` | 1.372.x (see §12) |
| PDF | `@react-pdf/renderer` | warranty card generation |
| | `pdf-parse` | knowledge ingest |
| Image | `sharp` | server-side resize (pinned 0.33.5) |
| Cache / rate-limit | `@upstash/redis` | Upstash (registration rate-limit, etc.) |
| Knowledge sync | `cheerio` | HTML scraping for AI knowledge base |
| Utilities | `date-fns`, `date-fns-tz`, `clsx`, `tailwind-merge`, `uuid`, `dotenv` | |
| Testing | Vitest, @testing-library/react, jsdom | unit + component |

> **Email** (Resend) is invoked over HTTP from the platform but the SDK lives in `auth-gateway/` and `functions/` — see §11.

### Monorepo Siblings

| App | Port | Purpose |
|---|---|---|
| `clicker-platform-v2/` | 3000 | This app — the multi-tenant platform |
| `auth-gateway/` | 3012 | Centralized login; mints custom tokens (§4) |
| `backyard/` | 3011 | Internal superadmin (tenants, modules, identities) |
| `functions/` | — | Firebase Cloud Functions (legacy + email + cron) |

---

<!-- Sections to be filled in by subsequent tasks -->

# Clicker Platform — Global Architecture Reference

> **Purpose:** Single source of truth for the Clicker Platform architecture. Read this before adding any feature, module, or template.
> **Last updated:** 2026-04-08

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure (Monorepo)](#2-repository-structure-monorepo)
3. [Multi-Tenant Routing](#3-multi-tenant-routing)
4. [Core vs. Module Boundary](#4-core-vs-module-boundary)
5. [Module System](#5-module-system)
6. [Template & Theme System](#6-template--theme-system)
7. [Block System (Canvas Studio)](#7-block-system-canvas-studio)
8. [Global Contexts](#8-global-contexts)
9. [Authentication & RBAC](#9-authentication--rbac)
10. [Database Paths](#10-database-paths)
11. [API Routes](#11-api-routes)
12. [Admin UI Conventions](#12-admin-ui-conventions)
13. [Key File Index](#13-key-file-index)
14. [Data Flow Diagrams](#14-data-flow-diagrams)

---

## 1. System Overview

The Clicker Platform is a **multi-tenant SaaS platform** where each tenant (business) gets:

- A public biolink/website at `/{tenantSlug}` or `{tenantSlug}.clicker.id`
- An admin dashboard at `/admin` (subdomain-enforced in production)
- Optional add-on **modules** (POS, Inventory, Membership, Reservations, AI Agent)
- A **template** (theme) chosen from 5 prebuilt designs

**Tech Stack:**
- **Framework:** Next.js App Router (v16+), React 19
- **Backend:** Firebase (Firestore, Auth, Storage)
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript
- **Drag & Drop:** @dnd-kit
- **Rich Text:** Tiptap v3

---

## 2. Repository Structure (Monorepo)

```
clicker-universe/dev/
├── clicker-platform-v2/    ← Main platform (this document applies here)
├── auth-gateway/           ← Centralized login service (auth.clicker.id)
├── backyard/               ← Super-admin dashboard (internal Clicker tool)
├── functions/              ← Firebase Cloud Functions
└── scripts/                ← Deployment & utility scripts
```

### clicker-platform-v2 Top-Level Layout

```
clicker-platform-v2/
├── app/                    ← Next.js App Router (all routes)
├── components/             ← React components
├── lib/                    ← Business logic, contexts, modules, templates
├── data/                   ← Static mock/seed data
├── hooks/                  ← Shared custom React hooks
├── scripts/                ← DB seed & admin scripts
├── middleware.ts           ← Multi-tenant routing logic
├── firestore.rules         ← Firestore security rules
└── storage.rules           ← Firebase Storage security rules
```

---

## 3. Multi-Tenant Routing

### How tenants are identified

| Scenario | URL | Tenant |
|---|---|---|
| Subdomain (production) | `quattro.clicker.id/` | `quattro` |
| Path-based (dev/fallback) | `clicker.id/quattro` | `quattro` |
| Admin subdomain | `quattro.clicker.id/admin` | `quattro` |

### Middleware Logic (`middleware.ts`)

1. **Subdomain detection:** `x-clicker-original-host` → `x-forwarded-host` → `host`
2. **Special routes** bypass tenant logic: `admin`, `auth`, `member`, `catalog`, `api`, `_next`
3. **Subdomain rewrite:** `quattro.clicker.id/about` → rewrites internally to `/quattro/about`
4. **Admin auth gate:** Missing `__session` cookie → redirect to `auth.clicker.id`
5. **Double-prefix sanitizer:** Prevents `/quattro/quattro/...` loops
6. **`x-site-id` header:** Set on all requests so Server Components know the tenant

### Admin Session Cookie

- Cookie name: `__session` (Firebase Hosting limitation)
- Value: the `siteId` of the active tenant
- Used to enforce multi-tenant admin isolation

### App Router Files

| Path | Description |
|---|---|
| `app/[tenant]/page.tsx` | Public home page for a tenant |
| `app/[tenant]/[...slug]/page.tsx` | Sub-pages & custom pages |
| `app/admin/(dashboard)/layout.tsx` | Admin shell with sidebar |
| `app/admin/(dashboard)/[...slug]/page.tsx` | Dynamic module routes |

---

## 4. Core vs. Module Boundary

This is the **most important architectural rule**.

```
┌─────────────────────────────────────────────────────────┐
│  CORE  (always enabled, all tenants)                    │
│  app/admin/(dashboard)/                                 │
│    ├── settings/   ← Business profile, team, identity  │
│    ├── pages/      ← Custom pages (Canvas Studio)      │
│    ├── links/      ← Link-in-bio                       │
│    ├── forms/      ← Form builder + Inbox              │
│    ├── products/   ← Base product catalog              │
│    └── canvas/     ← Canvas Studio editor              │
├─────────────────────────────────────────────────────────┤
│  MODULES  (opt-in per tenant)                           │
│  lib/modules/{module_id}/                               │
│    byod_pos/ | membership/ | inventory/                 │
│    reservation/ | ai_sales/ | service_records/          │
│    sales_pipeline/                                      │
└─────────────────────────────────────────────────────────┘
```

### The Golden Rules

1. **Core can import from Core.** Core NEVER imports from a module.
2. **Modules MUST NOT import from other modules.** Use dynamic checks (`isModuleEnabled()`) for cross-module logic.
3. **Module components are registered in the component registry** and loaded dynamically.
4. **Module admin routes** are served via the catch-all `app/admin/(dashboard)/[...slug]/page.tsx`.

---

## 5. Module System

### Module Registration — 4 Required Files

| File | Purpose |
|---|---|
| `lib/modules/definitions.ts` | Static admin route definitions per module |
| `lib/modules/components.tsx` | Dynamic component import registry |
| `lib/modules/registry.ts` | Runtime Firestore-based routing & widget lookup |
| `scripts/seed-modules.ts` | Firestore seed (run once per environment) |

> **Backyard parity:** Also update `dev/backyard/lib/modules/definitions.ts` when adding a new module.

### Module Structure (per module)

```
lib/modules/{module_id}/
├── admin/          ← Admin page components (loaded via registry)
├── public/         ← Public-facing pages/widgets
├── components/     ← Shared UI within this module
├── api.ts          ← Client-side Firestore operations
├── api-admin.ts    ← Admin-specific operations
├── api-server.ts   ← Server-side operations (uses firebase-admin)
├── constants.ts    ← DB path strings (NEVER hardcode paths inline)
├── types.ts        ← TypeScript types for this module
└── utils.ts        ← Helpers
```

### Registered Modules

| Module ID | Display Name | Admin Routes |
|---|---|---|
| `byod_pos` | Self-Order POS | Cashier, KDS, Transactions, Menu Manager, Settings, Reports |
| `membership` | Membership & Loyalty | Members, Member Details (hidden), Settings |
| `inventory` | Inventory | Items |
| `reservation` | Reservations | Bookings, Services, Staff (hidden), Settings |
| `ai_sales` | AI Sales Agent | Overview, Settings |
| `service_records` | Service Records | Records, Reports, New Record, Record Detail (hidden), Vehicles, Vehicle Detail (hidden), Service Types, Reminders, Settings |
| `sales_pipeline` | Sales Pipeline | Pipeline Board, Settings |

### How Module Routes Are Served

```
Request: /admin/pos/cashier
  │
  └─► app/admin/(dashboard)/[...slug]/page.tsx
        │
        └─► findModuleForAdminRoute('/admin/pos/cashier')
              │  (merges Firestore data + STATIC_MODULE_DEFINITIONS)
              └─► Returns componentKey: 'byod_pos:Cashier'
                    │
                    └─► MODULE_COMPONENTS['byod_pos:Cashier']
                          └─► dynamic(() => import('.../CashierClient'))
```

### ModuleDefinition Type

```typescript
interface ModuleDefinition {
    id: string;
    displayName: string;
    icon: string;
    version: string;
    enabled: boolean;
    adminRoutes?: AdminRoute[];
    publicRoutes?: PublicRouteDefinition[];
    collections?: string[];      // Firestore collections owned
    requires?: string[];         // Module dependencies
    blocks?: ModuleBlockDefinition[];
    dashboardWidgets?: ModuleWidgetDefinition[];
    settings?: Record<string, any>;
}
```

---

## 6. Template & Theme System

### 5 Built-in Templates

| Template ID | Name | Style | Card Style | Layout |
|---|---|---|---|---|
| `classic` | Sunnyside Original | Green/lime brutalist | brutalist + shadow | narrow, mobile-only nav |
| `modern` | Modern Clean | Yellow/black monospace | clean + shadow | boxed, adaptive nav |
| `sojourner` | Sojourner | Green, professional | clean + outlined | full-width, adaptive nav |
| `shuvo` | Shuvo Real Estate | Black/orange minimal | clean + flat | tablet, adaptive + bottom nav |
| `mrb` | Mr Brightside | Dark + neon orange glass | glass + outlined | tablet, adaptive + bottom nav |

### Template Files

```
lib/templates/
├── definitions.ts   ← TemplateDefinition objects for all 5 templates
├── registry.ts      ← Maps template ID → header/component implementations
├── layoutUtils.ts   ← containerWidth, navMode, grid helpers
├── service.ts       ← Template load/merge logic
└── types.ts         ← TemplateDefinition, ThemeColors, ThemeFonts, etc.
```

### TemplateConfig Shape

```typescript
config: {
    colors: { primary, accent, background, foreground, surface, border }
    fonts: { heading, body }
    borderRadius: string
    cardStyle: 'brutalist' | 'clean' | 'glass'
    cardVariant: 'shadow' | 'outlined' | 'flat'
    backgroundElements: []      // Decorative icons (classic only)
    headerLayout: 'center' | 'left'
    homeButtonStyle: 'pill' | 'text'
    layout: {
        containerWidth: 'narrow' | 'boxed' | 'full' | 'tablet'
        navMode: 'mobile-only' | 'adaptive'
        showBottomNav?: boolean
        grid: { mobile, tablet, desktop, gap }
    }
    defaultBlockLayouts: { hero, text, image, faq, map }
    custom?: {}                  // Template-specific overrides (shuvo, mrb)
}
```

### Template-Specific Block Overrides (MRB)

The MRB template registers custom block renderers in `lib/templates/registry.ts`:
- `MrbHero` → replaces default `hero` block
- `MrbQuickActions` → replaces default `quick_actions` block
- `MrbOperatingHours` → replaces default `hours` block

Custom header: `components/headers/MrbHeader.tsx`

---

## 7. Block System (Canvas Studio)

### Block Types

| Type | Description |
|---|---|
| `hero` | Hero/banner section |
| `text` | Rich text content (Tiptap) |
| `image` | Single image |
| `button` | CTA button |
| `products` | Product list |
| `faq` | Accordion FAQ |
| `link` | Link card |
| `map` | Google Maps embed |
| `image_gallery` | Photo gallery |
| `quick_actions` | Action buttons grid |
| `hours` | Operating hours display |
| `featured_product` | Featured product card |
| `branches` | Branch locations list |
| `social_embed` | Social media embed (Instagram, TikTok, etc.) |

### Canvas Studio Files

```
components/admin/blocks/
├── CanvasStudio.tsx        ← Main editor shell
├── BlockManager.tsx        ← Block list + drag-to-reorder
├── BlockFormRenderer.tsx   ← Right-panel property editor
├── EditorContext.tsx       ← Editor state (selected block, page, etc.)
├── PageStudioContext.tsx   ← Page-level state
├── StudioTopBar.tsx        ← Save, publish controls
├── blockDefinitions.ts     ← BLOCK_OPTIONS array + getDefaultData()
├── forms/                  ← Per-block-type property forms
└── panels/                 ← Left sidebar panels (links, products, etc.)
```

### Block Rendering (Public Site)

```
components/blocks/
├── BlockRenderer.tsx       ← Dispatches to correct renderer by type
├── SafeBlockRenderer.tsx   ← Error-boundary wrapper
└── public/                 ← Default block renderer implementations
    └── Default{Type}Block.tsx
```

**Override chain:** Template registry → module registry → default renderer

---

## 8. Global Contexts

### `useSite()` — `lib/site-context.tsx`

Always use this to get the current tenant. **Never hardcode a siteId.**

```typescript
const { siteId, tenantSlug, isPending, isSubdomain } = useSite();
```

| Property | Type | Description |
|---|---|---|
| `siteId` | `string` | Canonical tenant ID (e.g. `"quattro"`) |
| `tenantSlug` | `string?` | URL slug |
| `isPending` | `boolean` | True if siteId not yet resolved |
| `isSubdomain` | `boolean` | Accessed via subdomain |

### `useUser()` — `lib/user-context.tsx`

Provides auth state + RBAC. Uses real-time Firestore listener — permission changes apply immediately without page reload.

```typescript
const { user, role, isOwner, hasAccess, canEdit } = useUser();
```

| Property / Method | Description |
|---|---|
| `user` | Firebase Auth `User` object |
| `role` | `'owner'` \| `'editor'` \| `'viewer'` \| `'staff'` |
| `isOwner` | Boolean shortcut |
| `hasAccess(moduleId, routeId)` | `true` if `full` or `view` access |
| `canEdit(moduleId, routeId)` | `true` if `full` access only |
| `getAccessLevel(moduleId, routeId)` | Returns `'full'` \| `'view'` \| `'none'` |

### `useAdminTheme()` — `lib/use-admin-theme.tsx`

Controls light/dark mode for the admin dashboard.

---

## 9. Authentication & RBAC

### Auth Flow

```
User visits quattro.clicker.id/admin
  │
  ├── middleware.ts checks __session cookie
  │     │
  │     ├── Missing → redirect to auth.clicker.id?redirect=...
  │     └── Present → set x-site-id header, continue
  │
  └── Admin layout reads x-site-id → renders SiteProvider + UserProvider
```

### Roles

| Role | Access |
|---|---|
| `owner` | Full access to everything (`permissions: ['*']`) |
| `staff` | Granular per-module-route access via `moduleAccess` map |

### `moduleAccess` Map (Firestore: `sites/{siteId}/members/{uid}`)

```json
{
  "role": "staff",
  "moduleAccess": {
    "byod_pos": {
      "cashier": "full",
      "transactions": "view",
      "settings": "none"
    }
  }
}
```

### RBAC Guard Pattern (Client Components)

```typescript
const { canEdit } = useUser();

const handleSave = async () => {
    if (!canEdit('byod_pos', 'cashier')) {
        alert('View-only access');
        return;
    }
    // proceed with write
};
```

### Module Alias

`byod_pos` and `pos` are treated as aliases in `user-context.tsx` for backward compatibility.

---

## 10. Database Paths

### Core Data

| Collection | Path | Description |
|---|---|---|
| Sites | `sites/{siteId}` | Tenant document |
| Members | `sites/{siteId}/members/{uid}` | Staff/owner records |
| Pages | `sites/{siteId}/pages/{pageId}` | Custom pages |
| Links | `sites/{siteId}/links/{linkId}` | Link-in-bio items |
| Products | `sites/{siteId}/products/{productId}` | Product catalog |
| Forms | `sites/{siteId}/forms/{formId}` | Form definitions |
| Submissions | `sites/{siteId}/submissions/{subId}` | Form submissions |

### Module Data

Pattern: `sites/{siteId}/modules/{module_id}/{collection}`

| Module | Example Path |
|---|---|
| byod_pos | `sites/{siteId}/modules/byod_pos/orders/{orderId}` |
| membership | `sites/{siteId}/modules/membership/members/{memberId}` |
| inventory | `sites/{siteId}/modules/inventory/items/{itemId}` |
| reservation | `sites/{siteId}/modules/reservation/bookings/{bookingId}` |
| sales_pipeline | `sites/{siteId}/leads/{leadId}` (board), `sites/{siteId}/modules/sales_pipeline/settings/config` (pipeline config) |

> **Rule:** Always define paths as constants in `lib/modules/{module_id}/constants.ts`. Never hardcode path strings in components or api files.

### Global Module Registry

`modules/{module_id}` — global (not per-tenant), stores `enabled`, `version`, `publicRoutes`, etc.

---

## 11. API Routes

```
app/api/
├── admin/
│   ├── knowledge/sync/         ← AI knowledge base sync
│   ├── knowledge/verify/       ← AI knowledge verification
│   ├── modules/ai-sales-agent/ ← AI agent config
│   ├── seed-templates/         ← Seed template data
│   └── team/add|remove/        ← Team management
├── ai-sales-agent/chat/        ← AI chat endpoint
├── analytics/track/            ← Analytics events
├── auth/check-access/          ← Auth verification
├── forms/create|delete|submit|update/  ← Form CRUD
├── submissions/update/         ← Submission status
├── upload/avatar|image/        ← File uploads
└── warranty/[warrantyCode]/pdf/ ← Service record warranty PDF generation
```

### Server Component vs Client Component Rules

| Context | Firebase SDK | Import From |
|---|---|---|
| Server Components / API Routes | `firebase-admin` | `@/lib/firebase-admin` |
| Client Components | Firebase client | `@/lib/firebase`, `firebase/firestore` |

---

## 12. Admin UI Conventions

### Card / Container

```tsx
<div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
```

### Input Fields

```tsx
<input className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none" />
```

### Primary Action Button

```tsx
<button className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark/90 shadow-sm transition-all">
```

### Status Badge

```tsx
<div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
    isActive ? 'bg-green-50 border-green-200 text-green-700'
             : 'bg-gray-100 border-gray-200 text-gray-400'
}`}>
```

### Anti-Patterns (NEVER use in admin UI)

- `border-[2px]` or `border-[3px]` on cards
- `border-brand-dark` on admin containers
- `shadow-sticker` (public site only)
- `hover:-translate-y-1` lift on cards
- Dividers with `border-t-2`

---

## 13. Key File Index

| File | Role |
|---|---|
| `middleware.ts` | Multi-tenant routing, auth gate |
| `lib/site-context.tsx` | Current tenant provider |
| `lib/user-context.tsx` | Auth + RBAC provider |
| `lib/rbac.ts` | Role definitions |
| `lib/firebase.ts` | Firebase client SDK config |
| `lib/firebase-admin.ts` | Firebase Admin SDK config |
| `lib/modules/definitions.ts` | Static module admin routes |
| `lib/modules/components.tsx` | Dynamic component registry |
| `lib/modules/registry.ts` | Runtime module routing (Firestore) |
| `lib/modules/types.ts` | ModuleDefinition, AdminRoute types |
| `lib/templates/definitions.ts` | 5 template configs |
| `lib/templates/registry.ts` | Template → component mapping |
| `lib/templates/types.ts` | Template type definitions |
| `lib/systemBlocks.ts` | System block definitions |
| `lib/use-admin-theme.tsx` | Admin dark/light mode |
| `components/admin/blocks/blockDefinitions.ts` | Block types + default data |
| `components/admin/blocks/CanvasStudio.tsx` | Page builder editor |
| `components/blocks/BlockRenderer.tsx` | Public block renderer |
| `scripts/seed-modules.ts` | Seed module definitions to Firestore |
| `app/admin/(dashboard)/[...slug]/page.tsx` | Module route catch-all |

---

## 14. Data Flow Diagrams

### Public Page Render

```
Request: quattro.clicker.id/about
  │
  middleware.ts → rewrite to /quattro/about, set x-site-id=quattro
  │
  app/[tenant]/[...slug]/page.tsx
    │
    ├── Fetch site doc from Firestore (sites/quattro)
    ├── Resolve template (sites/quattro.templateId)
    ├── Fetch page blocks (sites/quattro/pages/about/blocks)
    │
    └── PublicPageRenderer
          └── BlockRenderer (per block)
                ├── Check template registry for override
                ├── Check module registry for block type
                └── Default{Type}Block
```

### Admin Module Route

```
Request: /admin/pos/cashier
  │
  middleware.ts → verify __session cookie → set x-site-id
  │
  app/admin/(dashboard)/[...slug]/page.tsx
    │
    ├── findModuleForAdminRoute('/admin/pos/cashier')
    │     └── Merge STATIC_MODULE_DEFINITIONS + Firestore module doc
    │
    ├── Check user permissions: hasAccess('byod_pos', 'cashier')
    │
    └── MODULE_COMPONENTS['byod_pos:Cashier']
          └── dynamic import → CashierClient.tsx
```

### Module Enable Check (Cross-Module)

```typescript
// In byod_pos — before calling inventory API
import { isModuleEnabled } from '@/lib/modules/registry';

const inventoryEnabled = await isModuleEnabled('inventory');
if (inventoryEnabled) {
    // deduct stock
}
```

---

## Appendix: Adding a New Module (Checklist)

- [ ] Create `lib/modules/{module_id}/` with required files
- [ ] Add to `lib/modules/definitions.ts` (adminRoutes)
- [ ] Add components to `lib/modules/components.tsx` (dynamic imports)
- [ ] Add to `scripts/seed-modules.ts`
- [ ] Add to `dev/backyard/lib/modules/definitions.ts`
- [ ] Define DB paths in `constants.ts`
- [ ] Guard all writes with `canEdit()` check
- [ ] Use `useSite()` for siteId, never hardcode

## Appendix: Adding a New Template (Checklist)

- [ ] Add entry to `lib/templates/definitions.ts`
- [ ] Register header + optional block overrides in `lib/templates/registry.ts`
- [ ] Create header component in `components/headers/`
- [ ] Create any custom block components in `components/blocks/{templateId}/`
- [ ] Add seed entry if needed

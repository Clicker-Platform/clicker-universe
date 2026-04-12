# Infrastructure Analysis Report — Clicker Platform

> Generated: 2026-04-09 | Updated: 2026-04-10 (accuracy review)
> Purpose: Full platform analysis for migration planning (Firebase → Firebase + Cloudflare + MongoDB)

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Firestore Usage Analysis](#2-firestore-usage-analysis)
3. [Firebase Storage Analysis](#3-firebase-storage-analysis)
4. [Cloud Functions Analysis](#4-cloud-functions-analysis)
5. [Hosting & Rendering Analysis](#5-hosting--rendering-analysis)
6. [Multi-Tenancy Architecture](#6-multi-tenancy-architecture)
7. [Performance Bottlenecks](#7-performance-bottlenecks)

---

## 1. Current State Summary

| Layer | Technology | Region | Problem |
|-------|-----------|--------|---------|
| **Hosting** | Firebase Hosting (Next.js SSR) | us-central1 | SSR di US, user di Indonesia |
| **Database** | Firestore | us-central1 | Setiap read ~200ms+ RTT |
| **Storage** | Firebase Storage | us-central1 | Image load lambat, egress mahal |
| **Functions** | Cloud Functions | us-central1 | Callable functions latency tinggi |
| **Auth** | Firebase Auth | Global (Google infra) | OK, tidak perlu pindah |
| **CDN** | Tidak ada dedicated CDN | — | Static assets tidak edge-cached |

### Projects

- **Production**: `clicker-universe`
- **Staging**: `clicker-universe-stagging`
- **Hosting targets**: core (`clickerapps`), auth (`clicker-auth-gateway`), backyard (`clicker-backyard-app`)

### Firebase Config

- All hosting backends: `us-central1`, 1 GiB memory (core, auth, backyard), 512 MiB (website)
- Firestore + Storage rules in `clicker-platform-v2/`
- Emulators configured for local dev (auth:9099, functions:5001, firestore:8080)

---

## 2. Firestore Usage Analysis

### 2.1 Data Classification

#### PUBLIC / Read-Heavy (80%+ of all reads)

| Collection Path | Read Pattern | Frequency | Data Type |
|----------------|-------------|-----------|-----------|
| `sites/{siteId}/content/profile` | `getDoc()` one-time | **Every page load** | Business name, contact |
| `sites/{siteId}/content/business` | `getDoc()` one-time | **Every page load** | Hours, branches |
| `sites/{siteId}/content/siteSettings` | `onSnapshot()` realtime | Medium (admin edits) | Theme, nav config |
| `sites/{siteId}/links` | `getDocs()` one-time | **Every page load** | Link items |
| `sites/{siteId}/products` | `getDocs()` one-time | **Every page load** | Product catalog |
| `sites/{siteId}/content/featuredProduct` | `getDoc()` one-time | **Every page load** | Featured product ref |
| `sites/{siteId}/pages` | `getDocs()` one-time | On demand | Custom pages |
| `sites/{siteId}/branches` | `getDocs()` with orderBy | Medium | Branch locations |
| `sites/{siteId}/content/linkSettings` | `getDoc()` one-time | Low (admin) | Link section UI |
| `sites/{siteId}/content/productSettings` | `getDoc()` one-time | Low (admin) | Product section UI |
| `sites/{siteId}/modules/reservation/services` | `getDocs()` one-time | Medium | Service catalog |
| `sites/{siteId}/modules/byod_pos/menu_items` | `getDocs()` paginated | Medium | POS menu |

**Caching**: Uses React `cache()` for server-side request deduplication per render pass. No global cache layer (no Redis, Memcached).

#### REALTIME LISTENERS (onSnapshot) — 11+ Active Listeners

##### Core Platform Listeners

| Collection | Consumer | Limit | Use Case |
|-----------|----------|-------|----------|
| `sites/{siteId}/content/siteSettings` | `useNavigationConfig()` hook | — | Navigation config updates |
| `sites/{siteId}` (site doc) | `AdminSidebar.tsx` | Single doc | Site metadata for admin |
| `modules` (collection query) | `AdminSidebar.tsx` | — | Module enablement state |
| `sites/{siteId}/modules/reservation/bookings` | `AdminSidebar.tsx` | — | Booking count badge |
| `sites/{siteId}/inbox` | `InboxPanel.tsx` | — | Live form submissions |
| `sites/{siteId}/members` | `admin/settings/team/page.tsx` | — | Team members list |
| `sites/{siteId}` (site doc) | `admin/settings/team/page.tsx` | Single doc | Site config for team |
| `modules` (registry) | `registry.ts` → `subscribeToEnabledModules` | — | Module toggle live sync |
| `sites/{siteId}/modules/membership/members/{id}` | `user-context.tsx` | Single doc | Current member profile |

##### Module-Specific Listeners

| Collection | Consumer | Limit | Use Case |
|-----------|----------|-------|----------|
| `sites/{siteId}/modules/byod_pos/orders` | Cashier + KDS dashboard | Last 100 | POS live order updates |
| `sites/{siteId}/modules/byod_pos/orders/{id}` | `order-tracker-context.tsx` | Single doc | Customer order tracking |
| `sites/{siteId}/modules/sales_pipeline/leads` | CRM Kanban dashboard | Default 100 | Sales pipeline live |
| `sites/{siteId}/modules/service_records/{id}` | Detail view | Single doc | Status tracking live |
| `sites/{siteId}/modules/ai_sales/config` | `AgentSettingsPage.tsx` | Single doc | AI agent config live |
| `sites/{siteId}/modules/ai_sales/config` | `AgentTrainingSection.tsx` | Single doc | Training data live |
| `sites/{siteId}/modules/ai_sales/leads` | `AgentDashboard.tsx` | — | AI-captured leads live |
| `sites/{siteId}/modules/ai_sales/leads/{id}` | `ChatWidget.tsx` | Single doc | Active chat session |

#### TRANSACTIONAL / Write-Heavy

| Collection Path | Read Pattern | Write Pattern | Frequency |
|----------------|-------------|---------------|-----------|
| `sites/{siteId}/inbox` | Admin only | `addDoc()` (public create) | High (form submissions) |
| `sites/{siteId}/modules/byod_pos/orders` | Realtime + paginated | `updateDoc()` status | Very High |
| `sites/{siteId}/modules/membership/members` | `getDoc()` lookups | CRUD | Medium |
| `sites/{siteId}/modules/membership/transactions` | `getDocs()` analytics | `addDoc()` every transaction | High |
| `sites/{siteId}/modules/inventory/items` | `getDocs()` one-time | `runTransaction()` atomic | Medium |
| `sites/{siteId}/modules/inventory/transactions` | `getDocs()` analytics | `addDoc()` every stock change | High |
| `sites/{siteId}/modules/reservation/bookings` | `getDocs()` paginated | CRUD | Medium |
| `sites/{siteId}/modules/service_records/serviceRecords` | Paginated + realtime detail | Complex state machine | Medium |
| `sites/{siteId}/modules/sales_pipeline/leads` | Realtime | `addDoc()`, `updateDoc()` | High |

### 2.2 Collection Path Constants

```typescript
// Core Collections
sites/{siteId}/content/{profile|business|siteSettings|featuredProduct|linkSettings|productSettings|serviceCategories}
sites/{siteId}/links/{linkId}
sites/{siteId}/products/{productId}
sites/{siteId}/pages/{pageId}
sites/{siteId}/branches/{branchId}
sites/{siteId}/forms/{formId}
sites/{siteId}/inbox/{messageId}
sites/{siteId}/members/{memberId}          // Team members (RBAC)
sites/{siteId}/invitations/{email}
sites/{siteId}/serviceCatalog/{itemId}     // Shared by reservation + service_records

// POS Module
sites/{siteId}/modules/byod_pos/orders/{orderId}
sites/{siteId}/modules/byod_pos/menu_items/{itemId}
sites/{siteId}/modules/byod_pos/settings/config

// Membership Module
sites/{siteId}/modules/membership/members/{memberId}
sites/{siteId}/modules/membership/transactions/{txnId}
sites/{siteId}/modules/membership/settings/config

// Inventory Module
sites/{siteId}/modules/inventory/items/{itemId}
sites/{siteId}/modules/inventory/transactions/{txnId}

// Reservation Module
sites/{siteId}/modules/reservation/bookings/{bookingId}
sites/{siteId}/modules/reservation/settings/config

// Service Records Module
sites/{siteId}/modules/service_records/serviceRecords/{recordId}
sites/{siteId}/modules/service_records/vehicles/{vehicleId}
sites/{siteId}/modules/service_records/warrantyCards/{cardId}
sites/{siteId}/modules/service_records/reminderQueue/{entryId}
sites/{siteId}/modules/service_records/serviceConfig/config
sites/{siteId}/modules/service_records/carCatalog/{entryId}
sites/{siteId}/modules/service_records/serviceTypes/{typeId}

// Sales Pipeline Module
sites/{siteId}/modules/sales_pipeline/leads/{leadId}
sites/{siteId}/modules/sales_pipeline/settings/config

// AI Sales Agent
sites/{siteId}/modules/ai_sales/config
sites/{siteId}/modules/ai_sales/leads/{leadId}
```

### 2.3 Write Frequency Estimates (Per Site)

| Frequency | Collections |
|-----------|-------------|
| **High** (>100 writes/day) | POS orders, inventory transactions, membership transactions, sales pipeline leads |
| **Medium** (10-100/day) | Service records, bookings, form submissions, site settings |
| **Low** (<10/day) | Warranty cards, reminder queue, service catalog, membership config |

### 2.4 Firestore Features in Use

| Feature | Usage |
|---------|-------|
| Timestamps | `Timestamp.now()`, `serverTimestamp()` for auditing |
| Transactions | `runTransaction()` for inventory stock updates |
| Batch Writes | `writeBatch()` for seeding, bulk updates |
| Array Operations | `arrayUnion()`, `arrayRemove()` in modules |
| Collection Groups | `warrantyCards` and `members` (cross-site lookups) |
| Denormalization | Heavy (productName, memberName stored in transactions) |

---

## 3. Firebase Storage Analysis

### 3.1 Configuration

| Property | Value |
|----------|-------|
| **Bucket** | `clicker-universe.firebasestorage.app` |
| **Region** | us-central1 |
| **Max file size** | 5MB |
| **CDN** | Firebase built-in only (no dedicated CDN) |

### 3.2 Upload Locations & Paths

| Component | Path Pattern | File Types | Upload Method |
|-----------|-------------|-----------|---------------|
| Product Images | `sites/{siteId}/products/` | JPEG, PNG, WebP | Client SDK (`uploadBytes`) |
| Avatar/Profile | `sites/{siteId}/profile/` | JPEG, PNG, WebP, GIF | Client SDK |
| Rich Text Images | `sites/{siteId}/uploads/content/` | JPEG, PNG, WebP, GIF | Client SDK |
| Image Gallery | `sites/{siteId}/uploads/` | JPEG, PNG, WebP, GIF | Client SDK (full + thumb) |
| Form Uploads | `sites/{siteId}/form-uploads/` | JPEG, PNG, WebP | Client SDK |
| Assets | `sites/{siteId}/assets/` | PNG, JPEG, WebP, ICO, SVG | Client SDK |

### 3.3 Image Optimization Pipeline

| Stage | Process | Details |
|-------|---------|---------|
| **Client-side** | `lib/imageUtils.ts` | Canvas resize + WebP conversion (quality 0.85) — utilities only, no storage path logic |
| **Client upload** | `lib/upload.ts` | Direct `uploadBytes` to Firebase Storage |
| **Server-side** | `api/upload/image/route.ts` | Sharp: resize max 800x800, WebP quality 0.80 |
| **Next.js** | `next.config.mjs` | Image optimization: AVIF + WebP, 30-day cache TTL |

### 3.4 URL Pattern

```
https://firebasestorage.googleapis.com/v0/b/clicker-universe.firebasestorage.app/o/{encodedPath}?alt=media&token={uuid}
```

### 3.5 Storage Security Rules

```
Read:  Public (all users, no auth required)
Write: Authenticated users only, scoped to sites/{siteId}/ paths
```

### 3.6 Storage Gaps

- No dedicated CDN (Firebase built-in only)
- No image deletion/lifecycle policy
- No storage metrics/monitoring
- No backup/replication strategy

---

## 4. Cloud Functions Analysis

### 4.1 Function Inventory

All functions are **HTTP Callable** (`functions.https.onCall`), all in **us-central1**.

#### Auth & User Management

| Function | Purpose | Latency |
|----------|---------|---------|
| `generateHandoffToken` | Cross-app auth token for platform switching | Low |
| `createUser` | Create/update users with role/site assignments | Low |
| `removeUserFromSite` | Remove user from site, update claims | Low |
| `deleteUser` | Delete user from Firebase Auth | Low |
| `listUsers` | Fetch up to 100 users for admin | Low |

#### RBAC

| Function | Purpose | Latency |
|----------|---------|---------|
| `setCustomClaims` | Assign role + siteId custom claims | Low |
| `getUserByEmail` | Admin lookup by email | Low |

#### Tenant Management

| Function | Purpose | Latency |
|----------|---------|---------|
| `createTenant` | Create site + auto-seed all data | Background |
| `suspendTenant` | Toggle active/suspended | Low |
| `getTenants` | List all tenants | Low |
| `updateTenantModules` | Enable/disable modules + lazy seeding | Background |

#### Data Seeding

| Function | Purpose | Latency |
|----------|---------|---------|
| `seedModules` | Seed module definitions | Background |
| `seedSiteData` | Seed starter template for new site | Background |

> **Note**: `seedBookingData`, `seedInventoryData`, `seedMembershipData`, `seedSalesPipelineData` are **internal helpers** called by `seedSiteData` — not independently callable Cloud Functions.

### 4.2 Security Patterns

- All require authentication (except `createUser` bootstrap)
- Superadmin-only access for admin functions
- Root superadmin (`clickerplatform@gmail.com`) protected from modification
- No hardcoded credentials

### 4.3 External Integrations

| Service | Usage |
|---------|-------|
| Firebase Auth Admin | User CRUD, custom claims |
| Firestore Admin | Multi-tenant data operations |
| Sharp | Image processing (package included, limited use) |

**Not implemented**: No payment processor, email service, SMS, or third-party integrations in functions.

### 4.4 Runtime

- Node.js 22
- `firebase-admin@13.6.0`
- `firebase-functions@7.0.3`

---

## 5. Hosting & Rendering Analysis

### 5.1 Rendering Strategy Per Route

| Route | Strategy | Revalidate | Notes |
|-------|----------|-----------|-------|
| Root layout `/` | ISR | 3600s (1hr) | Site metadata |
| `[tenant]/` (homepage) | ISR | 60s | Public biolinks |
| `[tenant]/[...slug]` (pages) | ISR | 60s | Custom pages |
| `/catalog` | SSR | 0 (no cache) | Dynamic filtering |
| `/member/login` | Force-dynamic | — | Auth state |
| All `/api/*` routes (19) | Force-dynamic | — | Always fresh |
| Admin dashboard | Client-side | — | Firebase client SDK |

### 5.2 API Routes (19 total, all force-dynamic)

| Route | Purpose | Data Source |
|-------|---------|-------------|
| `/api/forms/{create,update,delete,route}` | Form CRUD | Firestore |
| `/api/forms/submit` | Form submission → inbox | Firestore + email + pipeline |
| `/api/submissions/update` | Update submission status | Firestore |
| `/api/upload/{image,avatar}` | File upload + Sharp processing | Firebase Storage |
| `/api/auth/check-access` | Promote invitations → members | Firebase Admin |
| `/api/analytics/track` | Page view tracking | Firestore |
| `/api/ai-sales-agent/chat` | Gemini AI chat | Gemini API + Firestore |
| `/api/admin/{team,seed,knowledge,modules}/*` | Admin operations | Firestore |
| `/api/debug-firebase` | Firebase connection debug | Firebase Admin |
| `/api/warranty/[warrantyCode]/pdf` | PDF generation | React-PDF |

### 5.3 Data Fetching Patterns

**Server-side (`fetchData.ts`):**
- `fetchPublicData()` — parallel fetch: profile, links, products, business, settings
- `fetchLightweightPublicData()` — subset for layouts (skip products)
- `fetchPageBySlug()` — query-based page lookup
- `hydratePageBlocks()` — enrich blocks with services, staff, reservations
- All wrapped in React `cache()` for per-render deduplication

**Client-side:**
- Admin uses `useSite()` hook → `siteId` from context → Firebase client SDK
- Realtime listeners for live updates (POS, CRM, service records)

### 5.4 Caching Layers

| Layer | Implementation | Scope |
|-------|---------------|-------|
| React `cache()` | `fetchData.ts` wrapper | Per-render deduplication |
| Next.js ISR | `revalidate = 60` on tenant pages | Static HTML cache |
| Firebase Client SDK | Built-in offline cache | Client-side |
| **Missing** | No Redis/Memcached/Edge cache | — |

### 5.5 External API Dependencies

| Service | Usage | Auth |
|---------|-------|------|
| Google Gemini API | AI Sales Agent (multi-turn chat) | `GOOGLE_GENERATIVE_AI_KEY` |
| Firebase/Firestore | Primary database | Service account + client config |
| Firebase Storage | File uploads | Service account |
| Email (Resend/SendGrid) | Form notification emails | SMTP/API key |
| @react-pdf/renderer | Warranty card PDF | Local processing |

---

## 6. Multi-Tenancy Architecture

### 6.1 Request Flow

```
Browser
  → Cloudflare (rewrites x-original-host)
    → Firebase Hosting (Next.js SSR runtime)
      → Middleware (tenant resolution)
        → Sets x-site-id, x-tenant-slug headers
          → Server Components (read headers via next/headers)
            → SiteProvider Context (React context)
              → Client Components (useSite() hook)
                → Fetch data scoped to siteId
```

### 6.2 Tenant Resolution (middleware.ts)

1. **Subdomain detection**: `kasisehat.clicker.id` → rewrite to `/kasisehat`
2. **Path-based fallback**: `clicker.id/kasisehat` → pass through (for .web.app domains)
3. **Header propagation**: Sets `x-site-id` and `x-tenant-slug` for Server Components
4. **Admin auth**: Redirects `/admin/login` to centralized auth gateway
5. **Subdomain enforcement**: Authenticated users redirected to proper subdomain
6. **Double-prefix safety**: Cleans up `/tenant/tenant/...` patterns

### 6.3 Special Routes (Not Tenant-Scoped)

```
admin, auth, member, catalog, login, register, invite, 
setup, dashboard, api, _next, warranty
```

### 6.4 Firestore Data Structure

```
sites/{siteId}/
├── content/
│   ├── profile
│   ├── siteSettings
│   ├── business
│   ├── featuredProduct
│   ├── linkSettings
│   └── productSettings
├── links/
├── products/
├── pages/
├── forms/
├── inbox/
├── members/          (team RBAC)
├── invitations/
├── branches/
├── serviceCatalog/   (shared: reservation + service_records)
├── analytics/
└── modules/
    ├── byod_pos/     { orders/, menu_items/, settings/ }
    ├── membership/   { members/, transactions/, settings/ }
    ├── inventory/    { items/, transactions/ }
    ├── reservation/  { bookings/, settings/ }
    ├── service_records/ { serviceRecords/, vehicles/, warrantyCards/, reminderQueue/, carCatalog/, serviceConfig/ }
    ├── sales_pipeline/  { leads/, settings/ }
    └── ai_sales/     { config, leads/ }
```

### 6.5 Module System

- Each module has `sites/{siteId}/modules/{moduleId}` config doc
- `isModuleEnabled(moduleId)` checks enablement flag
- Disabled modules render "not available" or 404
- Module registry enables SaaS-style feature toggles

---

## 7. Performance Bottlenecks

### 7.1 Critical Path (Public Page Load)

```
User (Indonesia) → Firebase Hosting (US) → SSR render
  → Firestore reads (US): profile + business + settings + links + products + pages
  → Firebase Storage (US): images
  → Return HTML to user

Total RTT: ~800ms-1500ms (vs ~100-200ms if served from Singapore)
```

### 7.2 Identified Bottlenecks

| Bottleneck | Impact | Severity |
|-----------|--------|----------|
| Firestore in US | Every page load = 200ms+ per read | **Critical** |
| Firebase Storage in US | Image load latency | **Critical** |
| SSR in US | HTML generation far from user | **High** |
| No edge CDN | Static assets not cached at edge | **High** |
| No global cache | Every request hits Firestore | **Medium** |
| ISR time-based only | No on-demand revalidation | **Low** |
| Module registry Firestore hit per route | Could cache in memory | **Low** |
| Catalog page `revalidate = 0` | No caching at all | **Low** |

---

## 8. Migration Plan: Firebase + Cloudflare + MongoDB

### 8.1 Target Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER (Indonesia)                  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              CLOUDFLARE EDGE (Singapore)              │
│  ┌─────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ CF Pages    │  │ CF Workers│  │ R2 Storage     │  │
│  │ (Static/ISR)│  │ (API Proxy│  │ (Images/Files) │  │
│  │             │  │  + Cache) │  │                │  │
│  └─────────────┘  └─────┬────┘  └────────────────┘  │
└──────────────────────────┼──────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ MongoDB Atlas│  │  Firestore   │  │ Firebase Auth│
│ (Singapore)  │  │  (US - slim) │  │  (Global)    │
│              │  │              │  │              │
│ • Products   │  │ • Realtime:  │  │ • Login      │
│ • Pages      │  │   - POS orders│ │ • Sessions   │
│ • Links      │  │   - CRM leads│  │ • Custom     │
│ • Profile    │  │   - Settings │  │   Claims     │
│ • Bookings   │  │              │  │              │
│ • Orders     │  │ • Auth data  │  │              │
│ • Inventory  │  │   (members,  │  │              │
│ • Analytics  │  │    invites)  │  │              │
│ • Inbox      │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 8.2 What Goes Where

| Data | Destination | Reason |
|------|-------------|--------|
| Products, Pages, Links, Profile, Business | **MongoDB Atlas (SG)** | Read-heavy, public, no realtime needed |
| Forms, Branches | **MongoDB Atlas (SG)** | Read-heavy, cheaper |
| Service Catalog | **MongoDB Atlas (SG)** | Shared cross-module, read-heavy |
| POS Orders (history) | **MongoDB Atlas (SG)** | Aggregation pipeline for reporting |
| POS Orders (live) | **Firestore** (keep) | `onSnapshot` realtime for cashier/KDS + order tracker |
| Membership members + transactions | **MongoDB Atlas (SG)** | Analytics, aggregation |
| Inventory items + transactions | **MongoDB Atlas (SG)** | Stock reporting, audit trail |
| Bookings | **Firestore** (keep) | `onSnapshot` realtime in AdminSidebar badge count |
| Service Records + Vehicles + Warranty | **MongoDB Atlas (SG)** | Complex queries, state machine |
| Sales Pipeline leads (live) | **Firestore** (keep) | `onSnapshot` realtime for Kanban |
| Site Settings (nav config) | **Firestore** (keep) | `onSnapshot` realtime for nav updates |
| Site doc (metadata) | **Firestore** (keep) | `onSnapshot` in AdminSidebar + team settings |
| Inbox (submissions) | **Firestore** (keep) | `onSnapshot` realtime in InboxPanel |
| Team Members, Invitations, RBAC | **Firestore** (keep) | `onSnapshot` in team page + tightly coupled with Firebase Auth |
| Module Registry | **Firestore** (keep) | `subscribeToEnabledModules` realtime |
| AI Sales Agent (config + leads) | **Firestore** (keep) | 4 `onSnapshot` listeners across settings, training, dashboard, chat |
| Membership member (current user) | **Firestore** (keep) | `onSnapshot` in user-context for live profile |
| Firebase Auth | **Firebase Auth** (keep) | No alternative needed |
| Images, Files | **Cloudflare R2** | Zero egress cost, global edge |
| Static assets, ISR HTML | **Cloudflare Pages/CDN** | Edge-cached globally |

### 8.3 Migration Phases

#### Phase 1: Cloudflare Proxy + Edge Cache (1-2 days)

**Impact: First load 2-3x faster, zero code change**

- Cloudflare as reverse proxy in front of Firebase Hosting
- Cache ISR pages at edge (Singapore POP)
- Cache static assets (`_next/static`) at edge
- Custom domain routing via Cloudflare DNS

**Effort**: Low — DNS config + Cloudflare cache rules only

#### Phase 2: Storage → Cloudflare R2 (2-3 weeks)

**Impact: Image load drastically faster + zero egress cost**

- Migrate existing files from Firebase Storage → R2 (automated script)
- Update `lib/upload.ts` to write to R2
- Cloudflare Image Resizing for on-the-fly optimization (replace Sharp)
- Keep Firebase Storage read-only for backward compat (old URLs)
- Cloudflare Worker to redirect old Firebase URLs → R2

**Effort**: Medium

#### Phase 3: Read-heavy data → MongoDB Atlas Singapore (3-4 weeks)

**Impact: Data reads from ~200ms to ~20-30ms**

- MongoDB Atlas free tier (M0) in Singapore (ap-southeast-1)
- Migrate: products, pages, links, profile, business, settings, forms, branches, service catalog
- Data abstraction layer (`lib/db.ts`) for zero-downtime switch
- Dual-read period: read MongoDB primary, fallback Firestore
- Firestore scope reduced to: 11+ realtime listeners + auth/RBAC (see Section 2 for full list)

**Effort**: High

#### Phase 4: Transactional data + Reporting → MongoDB (4-6 weeks)

**Impact: Reporting 10x faster + significant cost reduction**

- Orders (history), inventory, membership transactions, service records → MongoDB
- MongoDB Aggregation Pipeline for reporting (replace Firestore queries)
- Time-series collections for analytics
- Firestore scope: 11+ realtime listeners + auth/RBAC (inbox, bookings, POS live, CRM, AI sales, module registry, admin sidebar, team settings)

**Effort**: High

### 8.4 Timeline Overview

```
Week 1:   Phase 1 (Cloudflare proxy) + MongoDB Atlas setup
Week 2-3: Phase 2 (Storage → R2) + Data abstraction layer
Week 3-4: Phase 3 (Core content → MongoDB)
Week 5-6: Phase 3 continued (Forms, Inbox, Catalogs)
Week 7-8: Phase 4 (POS, Membership, Inventory → MongoDB)
Week 9:   Phase 4 continued (Reservation, Service Records, Pipeline)
Week 10:  Testing, monitoring, Firestore cleanup
```

### 8.5 Cost Comparison (Estimated per month, moderate traffic)

| Item | Firebase Only | Hybrid (Firebase + CF + MongoDB) |
|------|-------------|----------------------------------|
| Firestore reads | $50-150 | $15-30 (70-80% reduced — 11+ realtime listeners remain) |
| Firestore writes | $20-50 | $10-25 (50% reduced — inbox, bookings, AI sales still write to Firestore) |
| Firebase Storage | $30-80 | $0-5 (R2 zero egress) |
| Firebase Hosting | $25-50 | $0-10 (CF Pages free tier) |
| Cloud Functions | $10-30 | $5-15 |
| MongoDB Atlas | $0 | $0-57 (free → M10) |
| Cloudflare | $0 | $0-20 (free → Pro) |
| **Total** | **$135-360** | **$30-162** |

### 8.6 MongoDB Atlas Tier Recommendation

| Tier | Specs | Cost | Fits |
|------|-------|------|------|
| **M0 Free** | 512MB, shared | $0 | Sufficient for 10 sites (~100MB data) |
| **M2 Shared** | 2GB, shared | $9/mo | 50-200 sites |
| **M10 Dedicated** | 10GB, dedicated | $57/mo | 200+ sites, production |

**Recommendation**: Start with M0 Free in Singapore. Upgrade when needed.

---

## 9. MongoDB Schema Design

### 9.1 Design Principles

Firestore uses nested subcollections (`sites/{siteId}/modules/byod_pos/orders`).
MongoDB flattens these into top-level collections with `siteId` as a partition field.

**Embed vs Separate:**
- **Embed**: Site content (profile, business, settings) → into `sites` collection (always fetched together, rarely updated independently)
- **Separate**: High-volume transactional data → own collection (unbounded growth, need pagination)

### 9.2 Database Structure

```
clicker_db/
├── sites                      # Site metadata + embedded content
├── pages                      # Custom pages with blocks
├── products                   # Product catalog
├── links                      # Link items
├── forms                      # Form definitions
├── inbox                      # Form submissions
├── service_catalog            # Shared services (reservation + service_records)
├── branches                   # Business locations
│
├── pos_orders                 # POS order history (high volume)
├── pos_menu_items             # POS menu items
├── pos_settings               # POS config (1 doc per site)
│
├── members                    # Loyalty/membership members
├── member_transactions        # Point history
├── membership_settings        # Module config
│
├── inventory_items            # Stock items
├── inventory_transactions     # Stock audit trail
│
├── bookings                   # Reservation bookings
├── reservation_settings       # Booking config
│
├── service_records            # Work orders
├── vehicles                   # Vehicle registry
├── warranty_cards             # Warranty cards (global lookup by code)
├── reminder_queue             # Scheduled reminders
├── car_catalog                # Car make/model reference
│
├── leads                      # CRM pipeline leads
├── pipeline_settings          # Pipeline stages config
│
└── ai_sales_config            # AI agent config
```

### 9.3 Collection Schemas

#### `sites` (Embedded Content)

```javascript
{
  _id: "kasisehat",                    // siteId as primary key
  name: "Kasi Sehat",
  domain: "kasisehat.clicker.id",
  ownerId: "firebase-uid-123",
  ownerEmail: "owner@example.com",
  isActive: true,
  modules: { pos: true, inventory: true, membership: true, reservation: false },
  
  // Embedded content (previously separate Firestore docs)
  content: {
    profile: {
      name: "Kasi Sehat",
      tagline: "Your Quality Brand",
      description: "Welcome...",
      avatarUrl: "https://cdn.clicker.id/sites/kasisehat/profile/avatar.webp",
      contact: { email: "...", phone: "...", address: "..." },
      socialLinks: [],
      templateConfig: { activeTemplateId: "mrb" }
    },
    siteSettings: {
      title: "Kasi Sehat",
      description: "...",
      faviconUrl: "...",
      ogImageUrl: "...",
      themeColor: "#ec5b13",
      accentColor: "#ec5b13",
      fontFamily: "Inter",
      templateId: "mrb",
      backgroundImageUrl: "...",
      socialLinkItems: [],
      footerText: "",
      hideFooterContact: false,
      showHeaderAddress: false,
      homeBlockOrder: ["hero-1", "quick-actions-1", "hours-1"],
      hiddenBlockIds: [],
      borderRadius: "large",
      navigation: { topNav: [], bottomNav: [], fab: {} },
      seo: { title: "", description: "", image: "" },
      pixels: { facebookPixelId: "", googleAnalyticsId: "", tiktokPixelId: "" },
      homepageSlug: null
    },
    business: {
      enabled: true,
      label: "Opening Hours",
      tagText: "Open Now",
      monFri: "07:00 - 20:00",
      satSun: "08:00 - 22:00",
      schedule: [{ dayOfWeek: 0, isOpen: true, hours: [] }],
      whatsapp: "...",
      email: "...",
      address: "...",
      mapUrl: "..."
    },
    featuredProduct: { productId: "prod-123" },
    linkSettings: { sectionTitle: "Quick Actions", showOnHome: true },
    productSettings: {
      galleryTitle: "More Treats",
      showSectionTitle: true,
      itemsToShow: 6,
      whatsappBtnLabel: "Order via WhatsApp",
      whatsappMessageTemplate: "Hi, I'm interested in {product}",
      whatsappBtnColor: "#25D366",
      whatsappBtnTextColor: "#FFFFFF",
      featuredBtnText: "Order Now"
    }
  },

  seo: { title: "...", description: "...", noIndex: true },
  pixels: { facebookPixelId: "", googleAnalyticsId: "", tiktokPixelId: "" },
  createdAt: ISODate("2026-01-15T..."),
  updatedAt: ISODate("2026-04-09T...")
}
```

#### `products`

```javascript
{
  _id: "prod-abc123",             // preserve Firestore doc ID
  siteId: "kasisehat",            // partition key
  name: "Clicker Starter Pack",
  price: 100000,
  description: "A sample product...",
  imageUrl: "https://cdn.clicker.id/sites/kasisehat/products/1234.webp",
  images: ["url1", "url2"],
  category: "General",
  isActive: true,
  showPrice: true,
  showLabel: true,
  createdAt: ISODate("2026-01-15T...")
}
```

#### `pages`

```javascript
{
  _id: "page-home",
  siteId: "kasisehat",
  title: "Home",
  slug: "home",
  content: "",                     // legacy text
  blocks: [
    { id: "hero-1", type: "hero", data: { title: "...", subtitle: "...", buttonText: "...", buttonLink: "/admin", imageUrl: "..." }, order: 0 },
    { id: "quick-actions-1", type: "quick_actions", data: {}, order: 1 },
    { id: "hours-1", type: "hours", data: {}, order: 2 }
  ],
  seo: { title: "", description: "", image: "", noIndex: false },
  pixels: { facebookPixelId: "", googleAnalyticsId: "", tiktokPixelId: "" },
  templateConfig: { activeTemplateId: "mrb" },
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

#### `links`

```javascript
{
  _id: "link-001",
  siteId: "kasisehat",
  title: "Visit Admin Panel",
  subtitle: "",
  url: "https://kasisehat.clicker.id/admin",
  iconName: "Settings",
  highlight: false,
  order: 0,
  type: "url",                    // url | form | page
  formId: null,
  pageId: null,
  hideOnHome: false,
  openInNewTab: false,
  isActive: true,
  createdAt: ISODate("...")
}
```

#### `forms`

```javascript
{
  _id: "form-contact",
  siteId: "kasisehat",
  title: "Contact Us",
  buttonText: "Submit",
  isPublished: true,
  fields: [
    { id: "f1", type: "text", label: "Name", placeholder: "Your name", required: true },
    { id: "f2", type: "email", label: "Email", placeholder: "email@...", required: true },
    { id: "f3", type: "textarea", label: "Message", placeholder: "...", required: false }
  ],
  emailNotificationTo: "owner@example.com",
  createdAt: ISODate("...")
}
```

#### `inbox`

```javascript
{
  _id: ObjectId(),
  siteId: "kasisehat",
  formId: "form-contact",
  formTitle: "Contact Us",
  data: { Name: "John", Email: "john@...", Message: "Hello..." },
  fieldLabels: { f1: "Name", f2: "Email", f3: "Message" },
  status: "new",                  // new | read | archived
  submittedAt: ISODate("...")
}
```

#### `pos_orders`

```javascript
{
  _id: "order-xyz",
  siteId: "kasisehat",
  items: [
    { productId: "item-1", name: "Nasi Goreng", price: 25000, quantity: 2, notes: "Extra pedas", variantId: null, inventoryId: "inv-1", modifiers: [] }
  ],
  total: 50000,
  status: "completed",           // open | pending | preparing | ready | completed | cancelled
  customerName: "Budi",
  tableNumber: "5",
  orderType: "dine-in",
  memberId: "member-123",
  memberName: "Budi Santoso",
  pointsEarned: 50,
  paymentStatus: "paid",
  paymentMethod: "qris",
  taxBreakdown: { subtotal: 45000, serviceCharge: 2500, restaurantTax: 2500, total: 50000, rates: {} },
  createdAt: ISODate("...")
}
```

#### `pos_menu_items`

```javascript
{
  _id: "item-001",
  siteId: "kasisehat",
  name: "Nasi Goreng Special",
  price: 25000,
  category: "Main Course",
  description: "...",
  imageUrl: "https://cdn.clicker.id/...",
  images: [],
  isActive: true,
  variants: [
    { id: "v1", name: "Regular", price: 25000, inventoryId: "inv-1" },
    { id: "v2", name: "Large", price: 35000, inventoryId: "inv-2" }
  ]
}
```

#### `members` (Loyalty/Membership)

```javascript
{
  _id: "member-123",
  siteId: "kasisehat",
  uid: "firebase-uid-456",
  phoneNumber: "+6281234567890",
  email: "budi@example.com",
  fullName: "Budi Santoso",
  currentPoints: 1500,
  role: "member",
  totalSpent: 2500000,
  totalTransactions: 42,
  templateConfig: { activeTemplateId: "mrb", hasCustomConfig: false, unlockedTemplates: [] },
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

#### `member_transactions`

```javascript
{
  _id: ObjectId(),
  siteId: "kasisehat",
  memberId: "member-123",
  source: "POS",                  // POS | RESERVATION | MANUAL | EVENTS
  sourceRefId: "order-xyz",
  pointsDelta: 50,               // positive = earn, negative = redeem
  spendAmount: 50000,
  description: "Earned from Order #xyz",
  createdAt: ISODate("...")
}
```

#### `inventory_items`

```javascript
{
  _id: "inv-001",
  siteId: "kasisehat",
  sku: "RM-COF-001",
  name: "Coffee Beans (Arabica)",
  currentStock: 50,
  lowStockThreshold: 10,
  unit: "kg",
  costPrice: 120000,
  linkedPosItemId: "item-001",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

#### `inventory_transactions`

```javascript
{
  _id: ObjectId(),
  siteId: "kasisehat",
  itemId: "inv-001",
  itemName: "Coffee Beans (Arabica)",
  change: -5,
  reason: "sale",                 // purchase | sale | adjustment | waste | return
  referenceId: "order-xyz",
  notes: "",
  performedBy: "staff@example.com",
  timestamp: ISODate("...")
}
```

#### `bookings`

```javascript
{
  _id: "booking-001",
  siteId: "kasisehat",
  serviceId: "svc-001",
  serviceName: "Initial Consultation",
  customerId: "guest",
  customerName: "Rina",
  customerEmail: "rina@example.com",
  customerPhone: "+628123...",
  status: "confirmed",           // pending | confirmed | cancelled | completed
  isRead: true,
  startAt: ISODate("2026-04-10T09:00:00Z"),
  endAt: ISODate("2026-04-10T10:00:00Z"),
  staffId: "staff-1",
  staffName: "Dr. Andi",
  notes: "First visit",
  totalPrice: 150000,
  preferredDate: null,
  serviceRecordId: "sr-001",
  cancellationReason: null,
  assetId: null,
  assetModel: null,
  createdAt: ISODate("...")
}
```

#### `service_records`

```javascript
{
  _id: "sr-001",
  siteId: "kasisehat",
  outletId: "kasisehat",
  vehicleId: "veh-001",
  vehiclePlate: "B1234XYZ",
  memberId: "member-123",
  memberName: "Budi Santoso",
  memberPhone: "+628123...",
  memberEmail: "budi@...",
  serviceTypeId: "svc-coating",
  serviceTypeName: "Nano Ceramic Coating",
  hasWarranty: true,
  warrantyMonths: 12,
  productUsed: "Gyeon Q2 Pure",
  status: "COMPLETED",           // DRAFT | IN_PROGRESS | PENDING_APPROVAL | COMPLETED | CANCELLED
  paymentStatus: "PAID",         // UNPAID | PARTIAL | PAID
  paymentMethod: "TRANSFER",
  totalAmount: 3500000,
  amountPaid: 3500000,
  notes: "Full body coating",
  warrantyCardId: "wc-001",
  loyaltyPointsAwarded: 350,
  consumedItems: [
    { inventoryItemId: "inv-005", name: "Gyeon Q2 Pure 50ml", quantity: 2 }
  ],
  inventoryDeducted: true,
  bookingId: "booking-001",
  bookingSource: "reservation",
  approvedBy: "admin@example.com",
  approvedAt: ISODate("..."),
  cancelReason: null,
  createdAt: ISODate("..."),
  updatedAt: ISODate("..."),
  createdBy: "staff@example.com"
}
```

#### `warranty_cards`

```javascript
{
  _id: "wc-001",
  siteId: "kasisehat",
  warrantyCode: "MRB-2026-A1B2",    // globally unique
  serviceRecordId: "sr-001",
  outletId: "kasisehat",
  vehiclePlate: "B1234XYZ",
  vehicleType: "SUV",
  vehicleMakeModel: "Toyota Fortuner",
  ownerName: "Budi Santoso",
  ownerPhone: "+628123...",
  serviceTypeName: "Nano Ceramic Coating",
  productUsed: "Gyeon Q2 Pure",
  serviceDate: ISODate("2026-04-01T..."),
  warrantyMonths: 12,
  expiryDate: ISODate("2027-04-01T..."),
  status: "ACTIVE",               // ACTIVE | EXPIRED | VOIDED
  businessName: "Kasi Sehat Detailing",
  businessLogo: "https://cdn.clicker.id/...",
  createdAt: ISODate("...")
}
```

#### `vehicles`

```javascript
{
  _id: "veh-001",
  siteId: "kasisehat",
  plateNumber: "B1234XYZ",
  carCatalogId: "car-fortuner",
  color: "Black",
  memberId: "member-123",
  memberName: "Budi Santoso",
  outletId: "kasisehat",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

#### `leads`

```javascript
{
  _id: "lead-001",
  siteId: "kasisehat",
  name: "Prospek Baru",
  contact: "+628123...",
  source: "Website",
  notes: "Interested in coating package",
  stageId: "qualified",
  value: 5000000,
  createdAt: 1712700000000,       // timestamp ms (legacy format)
  updatedAt: 1712700000000
}
```

### 9.4 Required Indexes

```javascript
// Core content
db.products.createIndex({ siteId: 1, isActive: 1 })
db.products.createIndex({ siteId: 1, name: 1 })
db.pages.createIndex({ siteId: 1, slug: 1 }, { unique: true })
db.links.createIndex({ siteId: 1, order: 1 })
db.branches.createIndex({ siteId: 1, order: 1 })
db.inbox.createIndex({ siteId: 1, submittedAt: -1 })
db.inbox.createIndex({ siteId: 1, status: 1 })

// POS
db.pos_orders.createIndex({ siteId: 1, createdAt: -1 })
db.pos_orders.createIndex({ siteId: 1, status: 1, createdAt: -1 })
db.pos_menu_items.createIndex({ siteId: 1, name: 1 })
db.pos_menu_items.createIndex({ siteId: 1, category: 1 })

// Membership
db.members.createIndex({ siteId: 1, phoneNumber: 1 }, { unique: true })
db.members.createIndex({ siteId: 1, email: 1 }, { unique: true })
db.members.createIndex({ siteId: 1, uid: 1 })
db.members.createIndex({ siteId: 1, createdAt: -1 })
db.member_transactions.createIndex({ siteId: 1, memberId: 1, createdAt: -1 })

// Inventory
db.inventory_items.createIndex({ siteId: 1, name: 1 })
db.inventory_items.createIndex({ siteId: 1, sku: 1 }, { unique: true })
db.inventory_transactions.createIndex({ siteId: 1, itemId: 1, timestamp: -1 })

// Reservation
db.bookings.createIndex({ siteId: 1, status: 1, createdAt: -1 })
db.bookings.createIndex({ siteId: 1, startAt: 1 })
db.service_catalog.createIndex({ siteId: 1, isActive: 1 })

// Service Records
db.service_records.createIndex({ siteId: 1, status: 1, updatedAt: -1 })
db.service_records.createIndex({ siteId: 1, vehiclePlate: 1, createdAt: -1 })
db.vehicles.createIndex({ siteId: 1, plateNumber: 1 }, { unique: true })
db.warranty_cards.createIndex({ warrantyCode: 1 }, { unique: true })  // global lookup
db.warranty_cards.createIndex({ siteId: 1, createdAt: -1 })
db.reminder_queue.createIndex({ siteId: 1, status: 1, scheduledAt: 1 })

// Sales Pipeline
db.leads.createIndex({ siteId: 1, updatedAt: -1 })
db.leads.createIndex({ siteId: 1, stageId: 1 })
```

### 9.5 Relationships Map

```
sites (1) ──────────────── (N) products
  │                        (N) pages
  │                        (N) links
  │                        (N) forms ──── (N) inbox
  │                        (N) branches
  │                        (N) service_catalog ──┐
  │                                              │
  ├── pos_menu_items (N)                         │
  ├── pos_orders (N) ─── items[].inventoryId ──▶ inventory_items
  │       └── memberId ──▶ members               │
  │                                              │
  ├── members (N)                                │
  ├── member_transactions (N) ── memberId ──▶ members
  │                                              │
  ├── inventory_items (N)                        │
  ├── inventory_transactions (N) ── itemId ──▶ inventory_items
  │                                              │
  ├── bookings (N) ── serviceId ──▶ service_catalog
  │       └── serviceRecordId ──▶ service_records
  │                                              │
  ├── service_records (N) ── vehicleId ──▶ vehicles
  │       ├── memberId ──▶ members               │
  │       ├── serviceTypeId ──▶ service_catalog ─┘
  │       └── warrantyCardId ──▶ warranty_cards
  │
  ├── vehicles (N) ── memberId ──▶ members
  │       └── carCatalogId ──▶ car_catalog
  │
  ├── warranty_cards (N) ── serviceRecordId ──▶ service_records
  │
  ├── leads (N)
  └── ai_sales_config (1)
```

---

## 10. Data Migration Guide

### 10.1 Data Size Estimate (10 Sites)

| Category | Per Site | 10 Sites |
|----------|---------|----------|
| Core content (profile, settings, pages, links, products) | 200-400 KB | 2-4 MB |
| Transactional (orders, bookings, inventory txn, membership txn) | 2-10 MB | 20-100 MB |
| Module config & catalogs | 50-200 KB | 500 KB - 2 MB |
| **Total** | **~2-11 MB** | **~22-106 MB** |

MongoDB M0 Free Tier (512 MB) more than sufficient.

### 10.2 Migration Approach: Automated Recursive Export

**Why not manual export**: 10 sites x 30+ subcollections each = 300+ manual operations. Not feasible.

**Three options, ranked by recommendation:**

#### Option A: `firestore-export-import` NPM package (Recommended)

```bash
# Step 1: Export ENTIRE Firestore database to JSON (1 command)
npx firestore-export-import export \
  --accountCredentials serviceAccount.json \
  --backupPath ./firestore-backup.json

# Output: Single JSON file with ALL sites, ALL subcollections, ALL documents
# This recursively exports everything automatically

# Step 2: Transform JSON → MongoDB format (custom script)
node scripts/transform-for-mongodb.js

# Step 3: Import to MongoDB Atlas
mongoimport --uri "mongodb+srv://..." --collection sites --file sites.json
mongoimport --uri "mongodb+srv://..." --collection products --file products.json
# ... repeat for each collection
```

#### Option B: `gcloud firestore export` (Google Native)

```bash
# Export to Google Cloud Storage (built-in, fastest for large datasets)
gcloud firestore export gs://clicker-universe-backup \
  --collection-ids=sites

# Download and transform
gsutil cp -r gs://clicker-universe-backup ./backup
node scripts/transform-gcloud-export.js
```

#### Option C: Custom Recursive Script (Most Flexible)

```typescript
// Auto-discovers and exports ALL subcollections without hardcoding paths
async function exportDocument(docRef: DocumentReference): Promise<any> {
  const doc = await docRef.get();
  if (!doc.exists) return null;
  
  const data = { _firestoreId: doc.id, ...doc.data() };
  
  // Auto-discover subcollections
  const subcollections = await docRef.listCollections();
  for (const subcol of subcollections) {
    data[`_sub_${subcol.id}`] = [];
    const snapshots = await subcol.get();
    for (const subDoc of snapshots.docs) {
      const subData = await exportDocument(subDoc.ref);
      data[`_sub_${subcol.id}`].push(subData);
    }
  }
  return data;
}

// Export all 10 sites automatically
async function exportAllSites() {
  const sitesRef = db.collection('sites');
  const sites = await sitesRef.listDocuments();
  
  for (const siteRef of sites) {
    const fullSiteData = await exportDocument(siteRef);
    fs.writeFileSync(`./export/${siteRef.id}.json`, JSON.stringify(fullSiteData, null, 2));
    console.log(`Exported: ${siteRef.id}`);
  }
}
```

### 10.3 Transform Script (Firestore JSON → MongoDB)

```typescript
// scripts/transform-for-mongodb.ts
import { readFileSync, writeFileSync } from 'fs';

interface FirestoreExport {
  [collection: string]: {
    [docId: string]: any;
  };
}

function transformTimestamp(value: any): any {
  // Firestore Timestamp { _seconds, _nanoseconds } → ISODate
  if (value && typeof value === 'object') {
    if ('_seconds' in value && '_nanoseconds' in value) {
      return new Date(value._seconds * 1000 + value._nanoseconds / 1e6).toISOString();
    }
    if (Array.isArray(value)) return value.map(transformTimestamp);
    const result: any = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = transformTimestamp(v);
    }
    return result;
  }
  return value;
}

function transformSite(siteId: string, siteData: any) {
  const result: Record<string, any[]> = {
    sites: [],
    products: [],
    pages: [],
    links: [],
    forms: [],
    inbox: [],
    branches: [],
    service_catalog: [],
    pos_orders: [],
    pos_menu_items: [],
    members: [],
    member_transactions: [],
    inventory_items: [],
    inventory_transactions: [],
    bookings: [],
    service_records: [],
    vehicles: [],
    warranty_cards: [],
    reminder_queue: [],
    leads: [],
  };

  // 1. Site document with embedded content
  result.sites.push({
    _id: siteId,
    ...transformTimestamp(siteData),
    content: {
      profile: transformTimestamp(siteData._sub_content?.profile || {}),
      siteSettings: transformTimestamp(siteData._sub_content?.siteSettings || {}),
      business: transformTimestamp(siteData._sub_content?.business || {}),
      featuredProduct: transformTimestamp(siteData._sub_content?.featuredProduct || {}),
      linkSettings: transformTimestamp(siteData._sub_content?.linkSettings || {}),
      productSettings: transformTimestamp(siteData._sub_content?.productSettings || {}),
    }
  });

  // 2. Flatten subcollections with siteId
  const flattenCollection = (subKey: string, targetCollection: string) => {
    const docs = siteData[`_sub_${subKey}`] || [];
    for (const doc of docs) {
      const { _firestoreId, ...data } = transformTimestamp(doc);
      result[targetCollection].push({
        _id: _firestoreId,
        siteId: siteId,
        ...data,
      });
    }
  };

  flattenCollection('products', 'products');
  flattenCollection('pages', 'pages');
  flattenCollection('links', 'links');
  flattenCollection('forms', 'forms');
  flattenCollection('inbox', 'inbox');
  flattenCollection('branches', 'branches');
  flattenCollection('serviceCatalog', 'service_catalog');
  
  // Module subcollections (nested deeper)
  // Handle: modules/byod_pos/orders → pos_orders
  // ... similar flatten logic for each module

  return result;
}
```

### 10.4 Storage Migration (Firebase → R2)

```typescript
// scripts/migrate-storage-to-r2.ts
import * as admin from 'firebase-admin';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY }
});

async function migrateStorage() {
  const bucket = admin.storage().bucket('clicker-universe.firebasestorage.app');
  
  for (const siteId of ALL_SITE_IDS) {
    console.log(`\nMigrating storage for site: ${siteId}`);
    
    // List all files under sites/{siteId}/
    const [files] = await bucket.getFiles({ prefix: `sites/${siteId}/` });
    console.log(`  Found ${files.length} files`);
    
    for (const file of files) {
      // 1. Download from Firebase
      const [buffer] = await file.download();
      
      // 2. Upload to R2 (same path)
      await r2.send(new PutObjectCommand({
        Bucket: 'clicker-uploads',
        Key: file.name,
        Body: buffer,
        ContentType: file.metadata.contentType,
      }));
      
      // 3. Verify
      const head = await r2.send(new HeadObjectCommand({
        Bucket: 'clicker-uploads',
        Key: file.name,
      }));
      
      if (head.ContentLength !== buffer.length) {
        throw new Error(`Size mismatch: ${file.name}`);
      }
      
      console.log(`  ✓ ${file.name} (${buffer.length} bytes)`);
    }
  }
  
  // Also migrate legacy paths (products/, uploads/ without sites/ prefix)
  const [legacyFiles] = await bucket.getFiles({ prefix: 'products/' });
  // ... same migration logic
}
```

### 10.5 URL Rewrite (Batch Update in MongoDB)

```typescript
// After storage migration, update all image URLs in MongoDB
async function rewriteUrls() {
  const OLD_BASE = 'firebasestorage.googleapis.com/v0/b/clicker-universe.firebasestorage.app/o/';
  const NEW_BASE = 'cdn.clicker.id/';

  // Helper to decode Firebase Storage URL path
  function firebaseUrlToR2Path(url: string): string {
    const encoded = url.split('/o/')[1]?.split('?')[0];
    return decodeURIComponent(encoded || '');
  }

  // Update products
  const products = await db.collection('products').find({
    imageUrl: { $regex: /firebasestorage\.googleapis\.com/ }
  }).toArray();

  for (const product of products) {
    const updates: any = {};
    if (product.imageUrl?.includes(OLD_BASE)) {
      updates.imageUrl = `https://${NEW_BASE}${firebaseUrlToR2Path(product.imageUrl)}`;
    }
    if (product.images?.length) {
      updates.images = product.images.map((url: string) =>
        url.includes(OLD_BASE) ? `https://${NEW_BASE}${firebaseUrlToR2Path(url)}` : url
      );
    }
    if (Object.keys(updates).length) {
      await db.collection('products').updateOne({ _id: product._id }, { $set: updates });
    }
  }

  // Repeat for: sites (avatarUrl, backgroundImageUrl, ogImageUrl, faviconUrl, businessLogo)
  // pos_menu_items (imageUrl, images)
  // warranty_cards (businessLogo)
  // pages (blocks[].data.imageUrl)
  // ... etc
}
```

### 10.6 Cloudflare Worker: Old URL Redirect

```typescript
// workers/url-redirect.ts
// Handles old Firebase Storage URLs → redirect to R2
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Intercept old Firebase Storage URLs
    if (url.hostname === 'firebasestorage.googleapis.com') {
      const encodedPath = url.pathname.split('/o/')[1];
      if (encodedPath) {
        const path = decodeURIComponent(encodedPath.split('?')[0]);
        return Response.redirect(`https://cdn.clicker.id/${path}`, 301);
      }
    }
    
    return fetch(request);
  }
};
```

### 10.7 Backward Compatibility: Zero Disruption

| Scenario | What Happens |
|----------|-------------|
| **Data in MongoDB** | All Firestore document IDs preserved as `_id` → references valid |
| **Old Firebase Storage URLs** | Cloudflare Worker redirects → R2 (301 permanent) |
| **Cached browser URLs** | Firebase Storage still serves (read-only) until cache expires |
| **New uploads** | Go directly to R2 via updated `lib/upload.ts` |
| **Login/Auth** | Firebase Auth unchanged — zero impact |
| **Realtime features** | Still on Firestore (POS, CRM, settings, service records) |
| **Client re-upload needed?** | **NO** — all existing data migrated automatically |
| **Client re-register needed?** | **NO** — Firebase Auth untouched |
| **Downtime?** | **NO** — dual-read period, gradual cutover |

### 10.8 Migration Execution Checklist

```
PRE-MIGRATION
[ ] MongoDB Atlas M0 cluster created in Singapore (ap-southeast-1)
[ ] Cloudflare R2 bucket created (clicker-uploads)
[ ] Custom domain configured (cdn.clicker.id → R2)
[ ] Service account JSON downloaded for clicker-universe project
[ ] List all 10 siteIds confirmed
[ ] Backup Firestore (gcloud firestore export) as safety net

DATA MIGRATION
[ ] Run Firestore export (Option A/B/C)
[ ] Run transform script (Firestore JSON → MongoDB format)
[ ] Import to MongoDB Atlas
[ ] Verify document counts match (per collection, per site)
[ ] Verify data integrity (spot-check 5 documents per collection)
[ ] Create all indexes (Section 9.4)

STORAGE MIGRATION
[ ] Run storage migration script (Firebase → R2)
[ ] Verify file counts match
[ ] Verify file sizes match (checksum)
[ ] Run URL rewrite script (update all imageUrl fields in MongoDB)
[ ] Deploy Cloudflare Worker for old URL redirects
[ ] Test: old URLs redirect to R2 correctly

APP MIGRATION
[ ] Deploy data abstraction layer (lib/db.ts)
[ ] Switch fetchData.ts to read from MongoDB
[ ] Switch module APIs to read from MongoDB
[ ] Switch upload.ts to write to R2
[ ] Enable dual-write (Firestore + MongoDB) for transition
[ ] Monitor 48 hours for errors
[ ] Disable Firestore writes (MongoDB becomes primary)
[ ] Keep Firestore read-only for realtime listeners

POST-MIGRATION
[ ] Performance testing (measure latency improvement)
[ ] Cost monitoring (compare Firebase vs hybrid costs)
[ ] Remove unused Firestore reads from codebase
[ ] Update Firestore security rules (restrict to realtime-only collections)
[ ] Document new architecture in ARCHITECTURE.md
```

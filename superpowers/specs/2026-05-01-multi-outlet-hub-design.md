# Multi-Outlet Reporting Hub — Design Spec

**Date:** 2026-05-01
**Status:** Approved — ready for implementation plan
**Source:** Brainstorm session 2026-05-01

---

## Problem

Tenant owners with multiple outlets each running a separate Clicker account (e.g. MoreFood Cafe with 5 outlets, each on its own siteId) have no unified way to view aggregated reports across the group. Building proper multi-branch support inside the platform is a 10–12h refactor with high blast radius (see `Docs/MULTI_BRANCH_POS_PLAN.md`, on hold).

## Goal

Ship a separate, standalone reporting hub app that pulls report data from each linked Clicker tenant via authenticated API and presents an aggregated dashboard. Read-only. POS reporting first, module-extensible.

## Non-Goals

- Real-time order monitoring (pull cadence is 15 min)
- Write operations against tenant data
- Self-service onboarding (operator-provisioned only in v1)
- Replacing per-tenant admin dashboards

---

## System Overview

```
┌─────────────────┐         ┌─────────────────┐
│ Tenant A Site   │         │ Tenant B Site   │  ... (N outlets)
│ clicker-platform│         │ clicker-platform│
│ /api/report/*   │         │ /api/report/*   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ HTTPS + X-API-Key         │
         └─────────────┬─────────────┘
                       │
                       ▼ pulled every 15 min (Vercel Cron)
            ┌──────────────────────┐
            │     Hub App          │
            │  (new standalone)    │
            │                      │
            │  ┌────────────────┐  │
            │  │ Cron worker    │──┼──→ writes to Postgres
            │  │ (ingestion)    │  │
            │  └────────────────┘  │
            │                      │
            │  ┌────────────────┐  │
            │  │ Dashboard UI   │──┼──→ reads from Postgres
            │  │ (Next.js)      │  │
            │  └────────────────┘  │
            └──────────┬───────────┘
                       │
                       ▼
                ┌──────────────┐
                │   Postgres   │
                │ (Supabase /  │
                │  Neon)       │
                └──────────────┘
```

**Two work areas:**
1. Platform-side: new `/api/report/*` endpoints + API key validation
2. New standalone hub app: cron ingestion + Next.js dashboard + Postgres

---

## Platform-Side Changes

### New Firestore collection: `sites/{siteId}/apiKeys/{keyId}`

```ts
{
  hashedKey: string,       // SHA-256 of raw key
  label: string,           // e.g. "MoreFood Hub"
  scopes: string[],        // e.g. ["reports:pos"]
  createdAt: Timestamp,
  lastUsedAt: Timestamp | null,
  isActive: boolean
}
```

### New file: `clicker-platform-v2/lib/api-key-auth.ts`

```ts
export async function validateApiKey(rawKey: string): Promise<{
  siteId: string;
  scopes: string[];
} | null>
```

- Hashes incoming key with SHA-256
- Queries `apiKeys` via `collectionGroup('apiKeys')` filtered by `hashedKey == hash && isActive == true`
- On match: updates `lastUsedAt`, returns `{ siteId, scopes }`
- On miss: returns `null`

### New routes

```
GET /api/report/pos/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
GET /api/report/pos/items?start=YYYY-MM-DD&end=YYYY-MM-DD
```

Each route:
1. Reads `X-API-Key` header → calls `validateApiKey()`
2. Returns 401 if invalid
3. Returns 403 if required scope (e.g. `reports:pos`) not present
4. Calls existing `getReportStats()` / `getItemsSales()` from `lib/modules/byod_pos/api-reports.ts`
5. Returns JSON in standard envelope:

```json
{
  "siteId": "abc123",
  "module": "pos",
  "period": { "start": "2026-05-01", "end": "2026-05-31" },
  "data": { /* ReportSummary or item array */ }
}
```

### Provisioning script

`clicker-platform-v2/scripts/provision-api-key.ts`

- Generates 32 random bytes → base64
- Hashes with SHA-256
- Writes Firestore doc to `sites/{siteId}/apiKeys/{keyId}`
- Prints raw key once to stdout
- Run by operator manually; no self-service UI in v1

### Rate limiting

In-memory limiter at the route layer: max 60 requests/min per API key. Returns 429 on overage. Sufficient for v1 since cron is well under any threshold.

### Estimated platform changes

~150 lines net. Zero changes to existing `api-reports.ts` logic — endpoints are thin wrappers.

---

## Hub App

### Directory structure

New top-level directory `hub/` (sibling to `clicker-platform-v2/`, `auth-gateway/`, `backyard/`):

```
hub/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Group overview
│   │   ├── pos/
│   │   │   ├── page.tsx              # Aggregated POS report
│   │   │   └── items/page.tsx        # Top items across outlets
│   │   └── outlets/page.tsx          # Manage linked outlets
│   └── api/
│       └── ingest/route.ts           # Cron-triggered ingestion endpoint
├── lib/
│   ├── db.ts                         # Drizzle client
│   ├── crypto.ts                     # AES encrypt/decrypt for API keys
│   ├── ingest/
│   │   ├── pos.ts                    # POS ingestion
│   │   └── runner.ts                 # Orchestrator (parallel fan-out)
│   ├── auth.ts                       # Hub auth (NextAuth or simple session)
│   └── outlets.ts                    # Outlet CRUD
├── drizzle/
│   ├── schema.ts
│   └── migrations/
└── package.json
```

### Stack

- Next.js 14 (matches platform)
- Drizzle ORM + Postgres
- Supabase or Neon for managed Postgres
- Vercel hosting + Vercel Cron
- Auth: NextAuth credentials provider (email/password); separate identity from Clicker tenants

### Why separate auth from Clicker

The hub user identity ≠ any single Clicker tenant identity. A hub user (e.g. MoreFood owner) links N Clicker outlets via API keys. Coupling auth would force the hub to pick one tenant as "primary," which doesn't match the mental model.

---

## Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  label TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, site_id)
);

CREATE TABLE pos_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_revenue NUMERIC(12, 2) NOT NULL,
  total_orders INTEGER NOT NULL,
  total_items_sold INTEGER NOT NULL,
  payment_breakdown JSONB,
  raw_summary JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outlet_id, date)
);

CREATE TABLE pos_item_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity_sold INTEGER NOT NULL,
  revenue NUMERIC(12, 2) NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outlet_id, date, item_name)
);

CREATE TABLE ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  rows_written INTEGER,
  duration_ms INTEGER,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema rationale

- **Daily granularity** — hub aggregates pre-computed reports, not raw orders. Tenant Firestore remains the source of truth for raw data.
- **`UNIQUE(outlet_id, date)`** — ingestion is idempotent; re-running is safe.
- **`raw_summary JSONB`** — full payload preserved so adding metrics later requires no backfill.
- **API keys encrypted at rest** with AES-256, key in env var `HUB_ENCRYPTION_KEY`. Decrypted only at ingest time, never logged.
- **Adding a new module** = add `<module>_daily_summary` table + add a function in `lib/ingest/`.

---

## Ingestion Flow

### Trigger

Vercel Cron hits `POST /api/ingest` every 15 minutes. Authorization via `CRON_SECRET` (Vercel handles this natively).

### Orchestrator (`hub/app/api/ingest/route.ts`)

```
1. Verify Authorization header == CRON_SECRET
2. Query: SELECT * FROM outlets WHERE is_active = true
3. Promise.allSettled fan-out (max 10 concurrent) over outlets:
   - decrypt api_key
   - compute date range: today + yesterday (catches late corrections)
   - call ingestPOS(outlet, dateRange)
4. Write per-outlet result to ingest_runs
5. Return { success: bool, summary: { ok: N, failed: M } }
```

### Per-outlet POS ingestion (`hub/lib/ingest/pos.ts`)

```ts
async function ingestPOS(outlet, { start, end }) {
  // 1. Fetch summary
  const summaryRes = await fetch(
    `${outlet.api_base_url}/api/report/pos/summary?start=${start}&end=${end}`,
    { headers: { 'X-API-Key': decrypt(outlet.api_key_encrypted) } }
  );

  // 2. Fetch item sales
  const itemsRes = await fetch(
    `${outlet.api_base_url}/api/report/pos/items?start=${start}&end=${end}`,
    { headers: { 'X-API-Key': decrypt(outlet.api_key_encrypted) } }
  );

  // 3. Upsert pos_daily_summary (one row per day in range)
  // 4. Upsert pos_item_sales (one row per day per item)
  // 5. Update outlets.last_synced_at
}
```

### Date window rationale

Pull "today + yesterday" every run:
- Today's data is incomplete (orders still arriving) — re-pull overwrites with latest
- Yesterday may have late corrections (refunds, cancellations)
- UNIQUE constraint makes idempotent upserts free

### Error handling

- One outlet failing does not block others (`Promise.allSettled`)
- Failures recorded in `ingest_runs.error_message`
- Hub dashboard surfaces "last synced X min ago" + status badge per outlet
- Manual "Re-sync now" button in `/outlets` for impatient owners

---

## Dashboard UI

### `/` — Group Overview

- Period selector: Today / 7d / 30d / Custom
- KPI cards: total revenue, total orders, total items sold (across all active outlets)
- Per-outlet breakdown table: outlet, revenue, orders, % of group total
- Last-synced timestamp + manual refresh button
- Outlet status badges: green (synced <30 min), yellow (stale), red (last sync failed)

### `/pos` — POS Deep-Dive

- Daily revenue trend chart (line; toggle: stacked-by-outlet vs per-outlet lines)
- Payment method breakdown (group total)
- Outlet comparison table (sortable: revenue, orders, AOV)

### `/pos/items` — Top Items

- Top 20 items across group: name, total qty, total revenue, # contributing outlets
- Click-through: outlet drilldown showing per-outlet item ranking
- Date range filter

### `/outlets` — Outlet Management

- List of linked outlets, edit/disable/remove actions
- "Add Outlet" form: label, siteId, api_base_url, paste API key
- "Test Connection" button before save (calls `/api/report/pos/summary` with key, verifies 200)

### `/login` — Hub Auth

- Email + password (NextAuth credentials)
- No self-service signup in v1 — accounts created via script

### Styling

Tailwind, reusing the platform's color tokens (`brand-dark`, `studio-blue`, etc.) for visual continuity.

---

## Security

### API key lifecycle

- **Generation:** 32 random bytes → base64 (raw key)
- **Storage on platform side:** SHA-256 hash only
- **Storage on hub side:** AES-256 encrypted with `HUB_ENCRYPTION_KEY` env var
- **Display:** raw key shown once at provisioning, never retrievable after
- **Rotation:** generate new key, mark old `isActive: false`, update hub outlet row

### Encryption

- AES-256-GCM
- `HUB_ENCRYPTION_KEY` is a 32-byte secret in env var
- Per-outlet IV (initialization vector) stored alongside ciphertext
- Decrypted only at ingest time, immediately released

### Logging hygiene

- API keys never logged (raw or encrypted)
- Error messages stripped of credentials before persisting to `ingest_runs`
- Platform-side `logger` records `{ siteId, route, scope, success, duration }` only

### Blast radius

The hub holds API keys for all groups onboarded. Treat as sensitive infrastructure:
- Separate env keys per environment (dev/staging/prod)
- Restrict DB access (Supabase row-level security or network rules)
- No key material in error responses sent to client

---

## Out of Scope (v1)

- Self-service hub signup
- Self-service API key generation by tenant owners
- Reservation / Membership / Inventory module ingestion (architecture supports adding them; not built in v1)
- Webhook-based push ingestion
- Multi-currency or multi-timezone normalization
- Alerts / notifications on metric thresholds
- Export to CSV / scheduled email reports

---

## Effort Estimate

| Area | Effort |
|---|---|
| Platform: API key auth + 2 routes + provisioning script | ~3h |
| Hub: Next.js scaffold, auth, DB schema, Drizzle setup | ~3h |
| Hub: Ingestion runner + POS ingester | ~2h |
| Hub: Dashboard pages (overview, POS, items, outlets) | ~4h |
| Hub: Encryption, rate limiting, error handling polish | ~2h |
| Manual testing with 2-outlet test setup | ~1h |
| **Total** | **~15h** |

---

## Validation Checklist

1. **Provision API key** for a test tenant → script outputs raw key, Firestore doc has only hash
2. **Hub: Add Outlet** with the raw key → "Test Connection" succeeds
3. **Trigger ingest manually** → `pos_daily_summary` and `pos_item_sales` populated for today + yesterday
4. **Re-trigger ingest** → no duplicate rows; existing rows updated with latest values
5. **Disable outlet** → next cron skips it; data retained
6. **Wrong API key** → 401 from platform, error logged in `ingest_runs`
7. **Dashboard** → group overview renders aggregated KPIs; per-outlet breakdown sums correctly
8. **Top items** → cross-outlet ranking pulls from all active outlets
9. **Rotate key** → mark old inactive, update hub row, ingestion continues without gap
10. **Rate limit** → 60+ requests/min from hub returns 429 (verify via load test)

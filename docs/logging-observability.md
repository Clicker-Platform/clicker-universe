# Logging & Observability — Clicker Platform

> Status: **Design / Brainstorm** — belum diimplementasi  
> Dibuat: 2026-04-25  
> Target implementasi: dev branch

---

## 1. Overview

Clicker Platform berjalan di atas **Firebase Hosting + Cloud Run + Cloud Functions (GCP)**. Ini berarti:

- Tidak ada akses ke log file langsung (serverless)
- Semua `console.*` otomatis tertangkap GCP Cloud Logging
- Tidak perlu Filebeat, Fluentd, Kafka, atau Logstash
- GCP sudah menyediakan Aggregate → Store → Index → Retain secara gratis

Yang perlu dibangun hanya **dua hal**:
1. `lib/logger.ts` — structured JSON logger (isi pipeline Collect + Parse)
2. Backyard `/monitoring` — UI visual untuk superadmin (isi pipeline Visualize)

---

## 2. Pipeline Mapping

| Stage | Tools Ideal | Realita Clicker |
|-------|------------|-----------------|
| **Collect** | Filebeat, Fluentd | `logger.ts` output JSON ke `stdout` → Cloud Run tangkap otomatis |
| **Aggregate** | Kafka, Logstash | GCP Cloud Logging kumpulkan dari semua service (platform, backyard, functions, auth-gateway) |
| **Parse** | Grok, Fluentd parser | GCP auto-parse JSON log jadi structured fields |
| **Store** | Elasticsearch, S3 | GCP Cloud Logging (hot, 30 hari), BigQuery export (cold) |
| **Index** | Elasticsearch, Loki | GCP Cloud Logging full-text search + filter by `jsonPayload.*` |
| **Analyze** | Kibana, Grafana | GCP Log Explorer + Metrics Explorer |
| **Visualize** | Grafana dashboard | Backyard `/monitoring` (Firestore real-time) + GCP Log Explorer |
| **Retain/Dispose** | Retention policy | GCP default 30 hari, Firestore TTL 7 hari |

---

## 3. Visual Monitoring — Tech Stack

### Layer 1: Backyard `/monitoring` (Primary — Wajib Dibangun)
- **Tech:** Firestore `platform_logs` + Next.js + Tailwind
- **Data:** Hanya error kritikal (whitelist ~12 event types)
- **Real-time:** Firestore `onSnapshot`
- **Features:**
  - Error feed per tenant (siteId)
  - Badge merah di Sidebar kalau ada error baru
  - Filter by level / siteId / event type
  - Auto-clear setelah TTL 7 hari
- **Cost:** ~$0.03/bulan

### Layer 2: GCP Log Explorer (Technical Deep-dive — Sudah Ada)
- **Tech:** GCP Console → Cloud Logging → Log Explorer
- **Data:** Semua log (error + warn + info)
- **Query contoh:**
  ```
  jsonPayload.level="error" AND jsonPayload.siteId="quattro"
  jsonPayload.event="wa.send.failed"
  ```
- **Cost:** Gratis (50GB/bulan included)

### Layer 3: GCP Alerting Policy (Email Alert — Opsional Phase 2)
- **Tech:** GCP Monitoring → Alerting → Email/Slack
- **Trigger:** Error rate > 10 dalam 5 menit
- **Cost:** Gratis

### Layer 4: Axiom (Advanced — Opsional Phase 3)
- **Tech:** `@axiomhq/js` → Axiom dashboard
- **Free tier:** 500GB/bulan ingest, 30 hari retention
- **Pros:** UI modern, query powerful (APL), live tail
- **Cons:** Data keluar GCP, vendor lock-in

---

## 4. Strategi Log Volume & Cost

### Masalah
Platform dengan 100 tenant aktif → estimasi ~72.000 error writes/hari kalau semua error masuk Firestore → **~$3.9/bulan** dan tidak perlu.

### Solusi: 4-Layer Filtering

#### 4.1 Tiga Destinasi Log

```
console.*  →  logger.ts  →  [filter]
                                ↓
              Level ERROR + event kritikal  →  GCP + Firestore platform_logs
              Level WARN                   →  GCP only
              Level INFO                   →  GCP only
              Level DEBUG                  →  Hapus di production
```

#### 4.2 Whitelist Event — Hanya 12 Event Masuk Firestore

```ts
const FIRESTORE_CRITICAL_EVENTS = [
  'middleware.env.missing',       // platform bisa total down
  'firebase.admin.init.failed',   // seluruh server-side broken
  'auth.callback.failed',         // merchant tidak bisa login
  'upload.image.failed',          // merchant tidak bisa upload
  'upload.avatar.failed',
  'wa.send.failed',               // WhatsApp tidak jalan
  'wa.webhook.site.not.found',
  'ai.chat.failed',               // AI agent tidak jalan
  'form.submit.failed',           // lead hilang
  'pos.checkout.failed',          // transaksi gagal
  'service.record.create.failed',
  'firestore.write.failed',       // data tidak tersimpan
]
```

#### 4.3 Deduplication — Max 1 Write per 5 Menit per Event per Tenant

Gunakan **document ID deterministik** bukan auto-ID:

```ts
// Key berubah setiap 5 menit
const dedupeKey = `${siteId}_${event}_${Math.floor(Date.now() / 300_000)}`

// setDoc dengan merge — tidak duplicate
await setDoc(doc(col, dedupeKey), data, { merge: true })
```

Hasil: error yang sama terjadi 1000x dalam 5 menit = **hanya 1 Firestore write**.

#### 4.4 TTL Auto-Delete — Tidak Menumpuk

```ts
{
  ttl: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // +7 hari
}
```

Firebase TTL policy otomatis hapus dokumen setelah `ttl` lewat. Tidak perlu cron job.

#### 4.5 Quota Guard — Hard Limit 500 Writes/Hari

```ts
// platform_meta/log_quota → { writesToday: 0, resetDate: '2026-04-25' }
if (writesToday >= 500) {
  // skip Firestore, GCP masih tangkap via console.error
  return
}
```

### Estimasi Cost Final

| Strategi | Writes/hari | Cost/bulan |
|----------|-------------|------------|
| Tanpa strategi | ~72.000 | ~$3.90 |
| Whitelist only | ~500 | ~$0.03 |
| + Dedup 5 menit | ~50 | ~$0.003 |
| + TTL 7 hari | tetap 50 | ~$0.003 |
| + Quota guard 500/hari | max 500 | ~$0.03 |

**Target: <500 writes/hari, ~$0.03/bulan.**

---

## 5. Standarisasi `console.*`

### Masalah Sekarang

| Pattern | Masalah |
|---------|---------|
| `console.error("Error:", e)` | Plain text, GCP tidak bisa filter by field |
| `console.error(e)` | Hanya object, tidak ada konteks |
| `console.log('[TenantPage] Tenant:', siteId)` | Campur debug + observability |
| Tidak ada `siteId` di banyak error | Tidak tahu tenant mana yang kena |

### Standar Baru

```ts
// SEBELUM
console.error("Error fetching business settings:", error)
console.warn('[Analytics] Skipped tracking: Invalid siteId', siteId)
console.log('[TenantPage] Tenant/SiteId:', siteId)

// SESUDAH
logger.error('business.settings.fetch.failed', { siteId, error: e.message })
logger.warn('analytics.invalid.siteId', { siteId })
// console.log debug → HAPUS
```

### Mapping Konversi

```
console.error  →  logger.error(event, { siteId, ...meta })  → GCP + Firestore (jika kritikal)
console.warn   →  logger.warn(event, { siteId, ...meta })   → GCP only
console.log    →  logger.info(event, { siteId, ...meta })   → GCP only (jika meaningful)
console.log    →  HAPUS                                      → debug logs tidak perlu
```

---

## 6. Full Log Inventory

### 6.1 Server-side Errors — Layer 1 (Firestore + GCP)

#### Middleware (`middleware.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `middleware.env.missing` | ERROR | `NEXT_PUBLIC_BASE_DOMAIN` tidak ada → platform total down |
| `middleware.env.missing` | ERROR | `NEXT_PUBLIC_AUTH_GATEWAY_URL` tidak ada → auth broken |

#### Auth (`admin-auth.ts`, `auth/callback/page.tsx`, `auth/check-access/route.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `auth.callback.failed` | ERROR | Sign-in error saat callback |
| `auth.sites.fetch.failed` | ERROR | Gagal ambil user sites |
| `auth.check.failed` | ERROR | check-access API error |
| `auth.membership.index.missing` | WARN | Firestore index belum dibuat |
| `auth.getUserSites.failed` | ERROR | getUserSites error |

#### Upload (`upload/image/route.ts`, `upload/avatar/route.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `upload.image.failed` | ERROR | Storage write error + siteId |
| `upload.avatar.failed` | ERROR | Storage write error + siteId |
| `upload.invalid.type` | WARN | File type tidak valid |
| `upload.size.exceeded` | WARN | File terlalu besar |

#### Analytics (`analytics/track/route.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `analytics.db.missing` | ERROR | Firebase db tidak init → silent data loss |
| `analytics.batch.failed` | ERROR | Firestore write fail |
| `analytics.permission.denied` | WARN | Rules block |
| `analytics.invalid.siteId` | WARN | Tracking skipped |

#### Forms (`forms/submit`, `forms/create`, `forms/update`, `forms/delete`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `form.submit.failed` | ERROR | Submission write fail + siteId + formId |
| `form.siteId.missing` | WARN | Tidak ada siteId di submission |
| `form.not.found` | WARN | formId tidak ada |
| `form.email.notify.failed` | WARN | Email notif gagal kirim |
| `form.create.failed` | ERROR | Create form fail |
| `form.update.failed` | ERROR | Update form fail |
| `form.delete.failed` | ERROR | Delete form fail |

#### WhatsApp (`webhook/whatsapp/route.ts`, `admin/whatsapp/*`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `wa.webhook.site.not.found` | WARN | phoneNumberId tidak cocok tenant mana pun |
| `wa.send.failed` | ERROR | Kirim pesan gagal + siteId |
| `wa.test.failed` | ERROR | Test connection gagal |
| `wa.disconnect.failed` | ERROR | Disconnect gagal |

#### AI Sales Agent (`ai-sales-agent/chat/route.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `ai.primary.model.failed` | WARN | Gemini primary fail, fallback triggered |
| `ai.chat.failed` | ERROR | Chat error + siteId |

#### AI Marketing (`admin/modules/ai-marketing/*`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `ai.marketing.generate.failed` | ERROR | Content generation fail + siteId |
| `ai.marketing.analyze.failed` | WARN | Asset analysis fail + siteId |

#### Team Management (`admin/team/add`, `admin/team/remove`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `team.add.failed` | ERROR | Invite/create member fail + siteId |
| `team.remove.failed` | ERROR | Remove member fail + siteId |

#### Knowledge Sync (`admin/knowledge/sync/route.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `knowledge.sync.failed` | ERROR | PDF/URL sync ke Gemini fail + siteId |

#### Firebase Admin (`firebase-admin.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `firebase.admin.init.failed` | ERROR | Service account key invalid/missing → seluruh server-side broken |

#### Cache/Redis (`cache/redis.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `cache.get.failed` | WARN | Redis GET error (fallback ke Firestore) |
| `cache.set.failed` | WARN | Redis SET error |
| `cache.invalidate.failed` | WARN | Redis invalidate error |

---

### 6.2 Module-level Errors — Layer 2 (GCP only)

#### POS (`byod_pos/api.ts`, `byod_pos/*`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `pos.subscription.denied` | WARN | Cashier listener permission denied |
| `pos.settings.no.siteId` | WARN | getPOSSettings tanpa siteId |
| `pos.checkout.failed` | ERROR | Checkout error + siteId |
| `pos.order.failed` | ERROR | Order write fail |
| `pos.kds.failed` | ERROR | KDS update fail |
| `pos.inventory.restricted` | WARN | Public POS tidak bisa akses stock |
| `pos.transactions.fetch.failed` | ERROR | Transactions fetch fail |

#### Reservation (`reservation/api.ts`, `reservation/admin/*`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `reservation.create.failed` | ERROR | Booking write fail + siteId |
| `reservation.staff.fetch.failed` | ERROR | Staff fetch fail |
| `reservation.settings.fetch.failed` | ERROR | Settings fetch fail |
| `reservation.loyalty.skipped` | INFO | Loyalty skip karena service records |
| `reservation.loyalty.awarded` | INFO | Points awarded |

#### Membership (`membership/api.ts`, `membership/admin/*`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `membership.load.failed` | ERROR | Member fetch fail + siteId |
| `membership.link.failed` | ERROR | Link auth UID ke member fail |
| `membership.settings.fetch.failed` | ERROR | Settings fetch fail |

#### Service Records (`service-records/api.ts`, `service-records/admin/*`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `service.inventory.deduct.failed` | ERROR | Stock deduction fail |
| `service.booking.complete.failed` | ERROR | Auto-complete booking fail |
| `service.loyalty.award.failed` | ERROR | Loyalty points fail |
| `service.record.fetch.failed` | ERROR | Records list fail |
| `service.vehicle.fetch.failed` | ERROR | Vehicle fetch fail |

#### Sales Pipeline (`sales-pipeline/api.ts`, `sales-pipeline/server-integration.ts`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `pipeline.lead.create.failed` | ERROR | Lead write fail + siteId + formId |
| `pipeline.board.fetch.failed` | ERROR | Board fetch fail |

#### Inventory (`inventory/admin/*`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `inventory.adjust.failed` | ERROR | Stock adjust fail + siteId + itemId |
| `inventory.history.fetch.failed` | ERROR | History fetch fail |

---

### 6.3 Client-side Errors — Layer 3 (Saat ini tidak tertangkap)

> Terjadi di browser merchant/customer. Perlu Error Boundary atau Sentry untuk menangkap.

#### Admin UI (`AdminSidebar.tsx`, `AdminTopBar.tsx`, `AdminGuard.tsx`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `admin.logout.failed` | ERROR | Sign out error |
| `admin.modules.fetch.failed` | ERROR | Sidebar modules tidak load |
| `admin.bookings.listener.failed` | ERROR | Realtime listener error |

#### Canvas/Blocks (`PageStudioContext.tsx`, `SafeBlockRenderer.tsx`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `canvas.save.failed` | ERROR | Page save fail + siteId + pageId |
| `canvas.block.render.failed` | ERROR | Block crash + blockType |
| `canvas.links.reorder.aborted` | WARN | siteId changed mid-drag |

#### Public Components (`LinkCard.tsx`, `FormModal.tsx`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `link.click.failed` | WARN | Analytics write fail |
| `form.submit.client.failed` | ERROR | Form submit error di public page |

#### Navigation (`NavigationProvider.tsx`)
| Event | Level | Keterangan |
|-------|-------|------------|
| `nav.provider.missing` | WARN | useNavigation outside provider |

---

### 6.4 Debug Logs — Wajib Dihapus di Production

> Ini `console.log` yang tidak mengandung informasi observability, hanya debug sementara.

| File | Line | Isi |
|------|------|-----|
| `app/[tenant]/page.tsx` | 25, 30 | `[TenantPage] Tenant/SiteId:` |
| `app/[tenant]/[...slug]/page.tsx` | 72 | `[TenantCatchAll] Tenant:` |
| `lib/firebase.ts` | 34 | Firebase config log — **BAHAYA, expose config** |
| `lib/fetchData.ts` | 29 | `[DEBUG] msg` |
| `app/api/upload/image/route.ts` | 13,38,50,69,83 | Verbose step logs |
| `app/api/upload/avatar/route.ts` | 17,40,60,74 | Verbose step logs |
| `lib/modules/byod_pos/components/POSWidget.tsx` | 153 | `Order Payload:` — expose order data |
| `lib/modules/membership/components/dashboard/MemberDashboard.tsx` | 45 | `DEBUG: Loading member...` |
| `lib/admin-auth.ts` | 127 | `[getUserSites] Returning sites:` |
| `lib/modules/reservation/api.ts` | 225, 247 | Verbose loyalty logs |
| `lib/modules/service-records/api.ts` | 415, 421, 434, 453 | Verbose step logs |
| `lib/modules/sales-pipeline/server-integration.ts` | 6, 28, 81 | Verbose step logs |
| `app/admin/auth/callback/page.tsx` | 132–171 | 8 verbose auth step logs |
| `app/api/auth/check-access/route.ts` | 15, 30, 55 | Verbose step logs |
| `app/api/admin/team/add/route.ts` | 66, 84, 87 | Verbose step logs |

---

## 7. Struktur Dokumen Firestore

### Collection: `platform_logs`

```ts
interface PlatformLog {
  // Identity
  level: 'error' | 'warn'
  event: string                    // e.g. 'upload.image.failed'
  service: 'clicker-platform' | 'backyard' | 'auth-gateway' | 'functions'

  // Context
  siteId: string | 'platform'      // 'platform' untuk error global
  message?: string                 // human-readable summary
  meta?: Record<string, unknown>   // detail tambahan (endpoint, errorCode, dll)

  // Time
  ts: Timestamp                    // kapan terjadi
  ttl: Timestamp                   // auto-delete (7 hari dari ts)

  // Dedup (document ID = dedupeKey)
  // format: `${siteId}_${event}_${Math.floor(Date.now() / 300_000)}`
  count?: number                   // berapa kali terjadi dalam window 5 menit (increment)
}
```

### Collection: `platform_meta/log_quota`

```ts
interface LogQuota {
  writesToday: number
  resetDate: string  // 'YYYY-MM-DD'
}
```

---

## 8. Arsitektur logger.ts

```
Error terjadi di platform
        ↓
   logger.error(event, ctx)
        ↓
   ┌──────────────────────────────────────────┐
   │  Step 1: console.error(JSON.stringify)   │ → GCP Cloud Logging (selalu, gratis)
   │                                          │
   │  Step 2: apakah event di whitelist?      │
   │          Tidak → stop                    │
   │          Ya → lanjut                     │
   │                                          │
   │  Step 3: cek quota hari ini < 500?       │
   │          Tidak → stop                    │
   │          Ya → lanjut                     │
   │                                          │
   │  Step 4: setDoc dengan dedupeKey         │ → Firestore platform_logs
   │          (max 1 write per 5 menit        │
   │           per event per siteId)          │
   └──────────────────────────────────────────┘
```

---

## 9. Backyard `/monitoring` — Fitur UI

### Halaman Utama
- **Error Feed** — list real-time dari `platform_logs` (Firestore `onSnapshot`)
- **Stats bar** — total errors hari ini, tenant paling banyak error, event paling sering
- **Filter** — by siteId, by event type, by level (error/warn)
- **Badge** — angka merah di Sidebar kalau ada error baru (unread count)

### Per-Error Card
```
[ERROR] upload.image.failed                    2 menit lalu
Tenant: quattro | Service: clicker-platform
"Storage write failed: permission-denied"
Meta: { endpoint: '/api/upload/image', errorCode: 'permission-denied' }
Count: 3x dalam 5 menit
```

### Sidebar Badge
```ts
// Unread = error yang masuk setelah lastSeenAt superadmin
const unreadCount = logs.filter(l => l.ts > lastSeenAt).length
```

---

## 10. Implementation Checklist

### Phase 1 — Logger & Firestore (Dev)
- [ ] Buat `lib/logger.ts` dengan 4-layer filtering
- [ ] Buat Firestore collection `platform_logs` + TTL policy
- [ ] Buat `platform_meta/log_quota` document
- [ ] Update Firestore security rules untuk `platform_logs`
- [ ] Replace semua `console.error` kritikal → `logger.error`
- [ ] Replace semua `console.warn` → `logger.warn`
- [ ] Hapus semua debug `console.log`

### Phase 2 — Backyard UI (Dev)
- [ ] Replace `app/monitoring/page.tsx` dengan live error feed
- [ ] Tambah unread badge di `components/Sidebar.tsx`
- [ ] Filter by siteId / event / level
- [ ] Stats bar (total errors, top tenant, top event)

### Phase 3 — Alerting (Opsional)
- [ ] GCP Alerting Policy → email kalau error rate > 10 dalam 5 menit
- [ ] Atau: Axiom free tier untuk advanced log explorer

---

## 11. Files yang Akan Dimodifikasi

### New Files
```
clicker-platform-v2/lib/logger.ts
```

### Modified Files
```
clicker-platform-v2/middleware.ts
clicker-platform-v2/lib/firebase-admin.ts
clicker-platform-v2/lib/admin-auth.ts
clicker-platform-v2/lib/fetchData.ts
clicker-platform-v2/lib/cache/redis.ts
clicker-platform-v2/app/api/analytics/track/route.ts
clicker-platform-v2/app/api/upload/image/route.ts
clicker-platform-v2/app/api/upload/avatar/route.ts
clicker-platform-v2/app/api/forms/submit/route.ts
clicker-platform-v2/app/api/forms/create/route.ts
clicker-platform-v2/app/api/forms/update/route.ts
clicker-platform-v2/app/api/forms/delete/route.ts
clicker-platform-v2/app/api/webhook/whatsapp/route.ts
clicker-platform-v2/app/api/ai-sales-agent/chat/route.ts
clicker-platform-v2/app/api/admin/team/add/route.ts
clicker-platform-v2/app/api/admin/team/remove/route.ts
clicker-platform-v2/app/api/admin/knowledge/sync/route.ts
clicker-platform-v2/app/api/admin/whatsapp/send/route.ts
clicker-platform-v2/lib/modules/byod_pos/api.ts
clicker-platform-v2/lib/modules/reservation/api.ts
clicker-platform-v2/lib/modules/membership/api.ts
clicker-platform-v2/lib/modules/service-records/api.ts
clicker-platform-v2/lib/modules/sales-pipeline/api.ts
clicker-platform-v2/lib/modules/inventory/admin/InventoryAdminPage.tsx

backyard/app/monitoring/page.tsx
backyard/components/Sidebar.tsx
```

### Firestore Config
```
clicker-platform-v2/firestore.rules  (tambah rules platform_logs)
```

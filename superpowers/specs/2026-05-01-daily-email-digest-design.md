# Daily Email Digest — Design Spec

**Date:** 2026-05-01
**Status:** Approved — ready for implementation plan
**Source:** Brainstorm session 2026-05-01

---

## Problem

Tenant owners have no automated summary of their outlet's daily performance. Checking the dashboard manually is friction. A daily email digest delivers key numbers to their inbox without requiring a login.

This is Phase 1 of the Multi-Outlet Reporting initiative — simpler than the full hub app (~15h), delivers immediate value, and validates demand before building aggregation infrastructure.

## Goal

Send one daily HTML email per outlet to the outlet owner, summarizing yesterday's activity across enabled modules (POS + Reservations in v1). Configurable send time, per-outlet.

## Non-Goals

- Cross-outlet aggregation (that's Phase 2 — the Hub app)
- Per-module email toggles (all enabled modules appear in v1)
- Self-service Resend setup (operator provisions API key)
- Retry logic on failed sends (next day is recovery)
- Real-time or intraday digests
- PDF attachments or CSV exports

---

## System Overview

```
Firebase Scheduled Function (every hour)
  │
  ├─ Query: all sites where digestSettings.enabled == true
  │
  └─ For each site (Promise.allSettled fan-out):
       ├─ Check if sendHour (timezone-aware) matches current UTC hour
       ├─ If yes → gather module data for yesterday
       │    ├─ POS: call api-reports.ts functions directly
       │    └─ Reservations: call getBookingsForDay(yesterday)
       ├─ Render HTML email
       ├─ Send via Resend
       └─ Write result to digestLogs/{date}
```

No new infra beyond Resend. All data is read from existing Firestore collections via existing API functions.

---

## Settings & Configuration

### Firestore location

Added to `sites/{siteId}/settings/general` (existing document):

```ts
digestSettings: {
  enabled: boolean,
  sendHour: number,        // 0–23, in site's local timezone
  timezone: string,        // IANA tz string, e.g. "Asia/Jakarta"
  recipientEmail: string,  // defaults to site owner email at setup
}
```

### Admin UI

New **"Daily Digest"** section in Settings → Notifications:
- Toggle: Enable / Disable
- Time picker: hour of day (local time)
- Recipient email field (pre-filled with owner email, editable)

No per-module toggles in v1 — all enabled modules appear automatically.

---

## Firebase Scheduled Function

### File

`functions/src/digest/index.ts` — exported as `sendDailyDigests`

### Schedule

Every hour on the hour (`every 1 hours` in Firebase scheduler).

### Logic

```
1. Get current UTC hour
2. Query Firestore collectionGroup or iterate known sites:
   - sites where digestSettings.enabled == true
3. For each site:
   a. Convert site's sendHour (IANA timezone) → UTC hour
   b. If UTC hour matches current UTC hour:
      - Gather data (see below)
      - Render email
      - Send via Resend
      - Write to digestLogs
4. Promise.allSettled — one failure does not block others
```

### Data gathering

Calls existing platform functions directly (not HTTP):

**POS** (if `modules.byod_pos.enabled`):
- `getReportStats(siteId, yesterday, yesterday)` from `lib/modules/byod_pos/api-reports.ts`
- `getItemsSales(siteId, yesterday, yesterday)` — take top 5 by revenue

**Reservations** (if `modules.reservation.enabled`):
- `getBookingsForDay(siteId, yesterday)` from `lib/modules/reservation/api.ts`
- Tally by status: completed, cancelled, pending/confirmed

"Yesterday" = calendar date in the site's own timezone.

### Error handling

- Failed sends: logged to `sites/{siteId}/digestLogs/{YYYY-MM-DD}` with `{ status: 'failed', error, attemptedAt }`
- Successful sends: `{ status: 'sent', sentAt, modulesIncluded: string[] }`
- No retry in v1 — next day's digest is the natural recovery
- Individual site failures do not surface to other sites (Promise.allSettled)

---

## Email Rendering

### File structure

```
functions/src/digest/
├── index.ts          # Scheduled function entry point
├── render.ts         # renderDigestEmail(site, moduleData) → { subject, html }
├── sections/
│   ├── pos.ts        # renderPOSSection(posData) → string (HTML fragment)
│   └── reservations.ts  # renderReservationsSection(bookings) → string
└── send.ts           # sendDigestEmail({ to, subject, html }) via Resend
```

### Email structure

```
Subject: [Outlet Name] — Daily Report, DD MMM YYYY

┌─────────────────────────────────────┐
│  [Outlet Name]                      │
│  Daily Report — DD MMM YYYY         │
├─────────────────────────────────────┤
│  POS Summary          (if enabled)  │
│  Revenue: Rp 1,234,000              │
│  Orders: 42                         │
│  Avg Order Value: Rp 29,381         │
│  Top Items:                         │
│    1. Nasi Goreng — 18 pcs          │
│    2. Es Teh — 15 pcs               │
│    ...                              │
├─────────────────────────────────────┤
│  Reservations         (if enabled)  │
│  Bookings: 8 total                  │
│  Completed: 7 | Cancelled: 1        │
│  Pending: 0                         │
├─────────────────────────────────────┤
│  Powered by Clicker                 │
│  [Open Dashboard →]                 │
└─────────────────────────────────────┘
```

### Implementation

- Pure function `renderDigestEmail(site, moduleData)` returns `{ subject: string, html: string }`
- No templating library — tagged template literals are sufficient
- Each module section is a separate `renderXxxSection()` function
- Email content is v1 baseline and easy to update — all copy lives in `render.ts` and section files
- Basic HTML only: table layout, inline styles, no external CSS

### Adding modules later

Add a new file `functions/src/digest/sections/<module>.ts` with a `renderXxxSection()` function, then plug it into `render.ts`. No other changes needed.

---

## Resend Integration

### Config

Resend API key stored in Firebase Functions environment config:
```
firebase functions:config:set resend.api_key="re_..."
```

Accessed in code as `functions.config().resend.api_key`.

### Sender address

`digest@mail.clicker.id` (or similar — operator sets up Resend domain in v1).

### send.ts

Thin wrapper:
```ts
await resend.emails.send({
  from: 'Clicker Digest <digest@mail.clicker.id>',
  to: recipientEmail,
  subject,
  html,
});
```

---

## Module Coverage (v1)

| Module | Data | Source function |
|---|---|---|
| POS | Revenue, orders, AOV, top 5 items | `getReportStats()`, `getItemsSales()` |
| Reservations | Total bookings, completed, cancelled, pending | `getBookingsForDay()` |

Future modules (Membership, Service Records, etc.) follow the same pattern: add a section file, add a data-fetch call in the scheduler.

---

## File Map

| File | Purpose |
|---|---|
| `functions/src/digest/index.ts` | Scheduled function, hourly fan-out |
| `functions/src/digest/render.ts` | Email renderer, assembles sections |
| `functions/src/digest/send.ts` | Resend API wrapper |
| `functions/src/digest/sections/pos.ts` | POS HTML section |
| `functions/src/digest/sections/reservations.ts` | Reservations HTML section |
| `clicker-platform-v2/app/admin/(dashboard)/settings/notifications/page.tsx` | New settings UI section |
| `clicker-platform-v2/lib/modules/digest/` | (optional) shared types for digestSettings |

---

## Effort Estimate

| Area | Effort |
|---|---|
| Firebase Scheduled Function + fan-out logic | ~1.5h |
| Email renderer + POS section | ~1.5h |
| Reservations section | ~0.5h |
| Resend integration + config | ~0.5h |
| Admin settings UI (toggle + time picker + email field) | ~1h |
| digestLogs write + error handling | ~0.5h |
| Manual testing (2 sites, both modules) | ~0.5h |
| **Total** | **~6h** |

---

## Validation Checklist

1. Set `digestSettings.enabled = true`, `sendHour = X` for a test site
2. Trigger function manually at the matching UTC hour → email arrives at recipient
3. Email contains POS section if POS module enabled, Reservations section if reservation module enabled
4. Site with only POS enabled → no Reservations section (and vice versa)
5. Both modules disabled → function skips the site (no email sent)
6. Resend API key missing → function logs error, does not crash other sites
7. One site fails data fetch → other sites still receive their emails
8. `digestLogs/{date}` doc written with correct status after each run
9. Change `sendHour` in settings → email arrives at new time next day
10. Recipient email changed in settings → digest goes to new address

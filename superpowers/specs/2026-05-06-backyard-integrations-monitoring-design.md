# Backyard Integrations Monitoring — Design Spec

**Date:** 2026-05-06
**Status:** Draft, awaiting user review
**Scope:** Monitoring UI for PostHog & Resend in the Backyard superadmin app, plus Firestore log retention cleanup.

---

## 1. Goal & Scope

### Goal
Add third-party integrations monitoring (PostHog & Resend) to the Backyard superadmin so operators can:

1. See PostHog & Resend health platform-wide.
2. Identify problem tenants (silent / high failure rate).
3. Triage email failures quickly when tenants report missing emails.
4. Drill down into failure detail (payload, error message) without impersonating tenants.

### Out of Scope
- Sentry / error tracking setup (separate future project).
- Real-time auto-refresh as default (manual + opt-in Live mode toggle only).
- Retry / test-send actions from Backyard (no destructive actions; impersonation is forbidden).
- Mirroring PostHog events to Firestore (we query PostHog API on demand instead).
- Per-event-type breakdown for PostHog (deep-dive belongs in PostHog UI).
- Tenant admin impersonation (superadmin cannot log in as tenants).

### Non-Goals — Important Constraints
- **No tenant impersonation.** Drill-downs are read-only info displays; no "Open tenant admin" link.
- **No PostHog event mirroring.** PostHog remains source of truth; Backyard reads via Query API only.

---

## 2. Architecture

### Pages & Tabs

`/monitoring` page (existing) gains two new top-level tabs:

```
System Health | Event Logs | PostHog | Resend
```

Each new tab is independent, with its own:
- Header bar: `[Refresh ↻]  Last updated: HH:MM:SS  [○ Live mode]  [Open in <service> →]`
- Live mode toggle state (off by default; ON enables 30s polling)

### File Layout

**Backyard (Next.js):**
```
backyard/
  app/monitoring/page.tsx                    # add PostHog & Resend tabs
  components/monitoring/
    PostHogTab.tsx                           # health card + per-tenant table
    ResendTab.tsx                            # summary + tenant table + failure feed
    EmailFailureDrawer.tsx                   # drill-down (payload + error)
    LiveModeToggle.tsx                       # shared: pause-on-hidden, pause-on-drawer
  lib/monitoring/
    usePosthogStats.ts                       # calls getPosthogStats Cloud Function
    useResendStats.ts                        # Firestore collection-group query
```

**Cloud Functions (`functions/`):**
```
functions/src/
  monitoring/getPosthogStats.ts              # callable, holds PostHog Personal API key
  scheduled/retentionCleanup.ts              # daily 02:00 WIB cleanup
```

### Why Cloud Functions for PostHog stats?
Backyard is "all-client + Cloud Functions only" per project convention (see `dev/CLAUDE.md`). Holding the PostHog Personal API key in a callable function:
- Keeps the secret server-side in Secret Manager (never reaches the browser).
- Reusable from the platform app later if needed.
- Consistent with existing Backyard architecture.

### Data Sources

| Section | Source | Access pattern |
|---|---|---|
| PostHog health & per-tenant | PostHog Query API (HogQL) | `getPosthogStats` callable, key in Secret Manager |
| Resend summary, tenant table, failure feed | Firestore `email_logs` collection group | Backyard client SDK (existing admin rules) |

PostHog events already include `siteId` (verified in `lib/analytics/useAnalytics.ts`), so `GROUP BY properties.siteId` works without additional instrumentation.

### Retention Cleanup (scheduled function)

`functions/src/scheduled/retentionCleanup.ts`:
- Trigger: Cloud Functions v2 `onSchedule`, daily at **02:00 WIB**.
- `platform_logs`: delete docs where `createdAt < now - 7d`.
- `email_logs` (collection group): delete docs where `sentAt OR createdAt < now - 30d` (use whichever exists; fallback to `createdAt`).
- Batch 500 per iteration (Firestore limit). Maximum **20 iterations per run** (10,000 docs/collection) to stay under function timeout. Remainder picked up next day.
- Emits `retention.cleanup.done` event to `platform_logs` on success with `{ deleted_platform_logs, deleted_email_logs, duration_ms }`.
- On failure: emits `retention.cleanup.failed` and **does not throw** (avoid retry storm). Next scheduled run resumes.
- Idempotent: cutoff filter never overlaps; safe to re-run.

---

## 3. Components & Data Flow

### PostHog Tab

**Layout:**
```
┌─ Header bar ─────────────────────────────────────────┐
│  [Refresh ↻]  Last updated: 14:32:05  [○ Live mode]  │
│                              [ Open in PostHog → ]   │
├──────────────────────────────────────────────────────┤
│  Status: ✓   Events 24h: 12,453   Last event: 2m ago │
├──────────────────────────────────────────────────────┤
│  Per-tenant table:                                    │
│  Site │ Events 24h │ Last event │ Status              │
│  acme │   3,210    │  1 min ago │ active              │
│  beta │      0     │   8h ago   │ idle                │
│  zeta │      0     │  10d ago   │ silent ⚠            │
└──────────────────────────────────────────────────────┘
```

**Status logic per tenant:**
- `active`: events in last 24h > 0
- `idle`: events 24h == 0 AND events 7d > 0
- `silent`: events 7d == 0 (potential setup issue)

**Data flow:**
1. `PostHogTab` mounts → `usePosthogStats({ window: '24h' })`.
2. Hook → `httpsCallable('getPosthogStats')`.
3. Function runs HogQL queries:
   - Health/total: `SELECT count(), max(timestamp) FROM events WHERE timestamp > now() - 24h`
   - Per-tenant 24h: `SELECT properties.siteId, count(), max(timestamp) FROM events WHERE timestamp > now() - 24h GROUP BY properties.siteId`
   - Per-tenant 7d (for status classification): `SELECT properties.siteId, count() FROM events WHERE timestamp > now() - 7d GROUP BY properties.siteId`
4. Function joins with `sites/` collection to map siteId → site name → returns `{ health, perTenant }`.
5. Hook caches 30s in memory; Live mode polls every 30s with Page Visibility guard.

### Resend Tab

**Layout:**
```
┌─ Header bar ─────────────────────────────────────────┐
│  [Refresh ↻]  Last updated: 14:32:05  [○ Live mode]  │
│                              [ Open in Resend → ]    │
├──────────────────────────────────────────────────────┤
│  Sent 24h: 1,234   Failed 24h: 28   Fail rate: 2.2%  │
├──────────────────────────────────────────────────────┤
│  Per-tenant table:                                    │
│  Site │ Sent │ Failed │ Rate │ Last sent              │
│  ...                                                  │
├──────────────────────────────────────────────────────┤
│  Recent failures (platform-wide, last 50):            │
│  Time  │ Site │ To       │ Template │ Error  │ ▶    │
│  ...   (click row → EmailFailureDrawer)               │
└──────────────────────────────────────────────────────┘
```

**Data flow:**
1. `ResendTab` mounts → `useResendStats({ window: '24h' })`.
2. Hook runs Firestore collection-group queries:
   - Aggregate: `email_logs where createdAt > now - 24h`, then group by `siteId`, count by `status`.
   - Recent failures: `email_logs where status == 'failed' order by createdAt desc limit 50`.
3. Site name lookup: batch `getDocs(sites/{siteId})` for siteIds appearing in results, cached per session.
4. Cache 30s; Live mode same as PostHog tab.

### EmailFailureDrawer

Slide-in panel from the right when a failure row is clicked:
- To, Cc, Bcc, From (name + address)
- Template alias + variables (if present)
- Error message + error code
- Tags
- Timestamps (created, last attempt, sentAt)
- Link "Open in Resend dashboard" using `resendId` if present
- Read-only site info: `Site ID`, site name, owner email, plan (pulled from `sites/{siteId}`)
- **No "Open admin" / impersonation links.**

### LiveModeToggle (shared)

- Off by default. When ON, parent tab polls every 30s.
- Pauses polling when:
  - Page Visibility API reports tab hidden.
  - A drawer/modal is open in the same tab (parent passes `paused` prop).
  - 3 consecutive polling errors → auto-disable + toast "Live mode paused due to errors".
- Resumes when visibility returns / drawer closes (manual re-enable required if auto-disabled).

---

## 4. Error Handling & Edge Cases

### PostHog API failures
| Failure | UI behavior |
|---|---|
| Unreachable / timeout | Status card "✗ Unreachable" + error message + Retry button; per-tenant table shows empty state "Data unavailable". |
| Invalid API key (401) | Status "✗ Auth failed" + instruction "Check `POSTHOG_PERSONAL_API_KEY` secret". |
| Rate limit (429) | Banner "PostHog rate limit hit, retry in Xs" (parse `Retry-After`); auto-disable Live mode for that window. |
| Tenant event without `siteId` (legacy) | Group as `(unknown)` row in table. |

### Resend Firestore queries
| Failure | UI behavior |
|---|---|
| Empty `email_logs` (new tenant or no email yet) | Empty state "No emails sent yet". |
| Query error | Inline error + Refresh button; tab does not crash. |
| Site deleted but logs remain | Fallback to raw siteId with `(deleted)` badge. |

### Live mode safeguards
- Tab hidden → pause polling.
- Drawer/modal open → pause polling for that tab.
- 3 consecutive errors → auto-disable + toast.

### Cleanup function
- Failure logs `retention.cleanup.failed` event but **does not throw** (no retry storm).
- Capped at 20 batches/run → max 10,000 docs/collection. Remainder runs next day.
- Idempotent: cutoff query never re-targets already-deleted docs.

---

## 5. Testing Strategy

### Unit tests
- `usePosthogStats.test.ts` — mock callable; verify status mapping (active/idle/silent), error states, Live mode pause behavior.
- `useResendStats.test.ts` — mock Firestore; verify aggregation (sent/failed/fail rate), tenant grouping, failure feed sort order.
- `LiveModeToggle.test.tsx` — verify Page Visibility pause, drawer-open pause, 3-error auto-disable.
- `retentionCleanup.test.ts` — mock Firestore; verify cutoff filter, batch loop, max iteration cap, log emit on success/failure.

### Integration tests (Cloud Function)
- `getPosthogStats.test.ts` — mock PostHog Query API responses (success, 401, 429, network error); verify response shape & error mapping.

### Manual QA checklist
- [ ] `/monitoring` shows 4 tabs; PostHog & Resend each render without error.
- [ ] PostHog with invalid API key → "Auth failed" status + instruction.
- [ ] PostHog with a tenant having no events 7d → tenant appears with `silent` badge.
- [ ] Resend with a brand-new tenant (no `email_logs`) → empty state correct.
- [ ] Click failure row in Resend → `EmailFailureDrawer` opens with payload + error.
- [ ] Live mode ON → switch to another browser tab → polling pauses (verify via DevTools Network).
- [ ] Open drawer → polling pauses until drawer closes.
- [ ] Trigger cleanup manually via `gcloud functions call retentionCleanup` → verify logs older than cutoff are deleted; `retention.cleanup.done` event present.

### Why no E2E
Backyard is an internal superadmin tool with single-digit users; manual QA is sufficient. Adding Playwright/Cypress is YAGNI for now.

---

## 6. Open Questions / Risks

- **PostHog Personal API key provisioning** — needs to be created in PostHog project settings and stored in Secret Manager before the callable function works. Implementation plan should include this as a setup step.
- **Cleanup function dry-run** — first deploy should be tested with a high cutoff (e.g., 365d) on staging before flipping to 7d/30d on prod.
- **Site name lookup cost** — collection-group `email_logs` aggregation may surface many siteIds; ensure batch lookups are deduped and cached per render.

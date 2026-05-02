# Daily Email Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send one daily HTML email per outlet summarizing yesterday's POS and Reservation activity, triggered by a Firebase Scheduled Function and delivered via Resend.

**Architecture:** A Firebase Scheduled Function (`sendDailyDigests`) runs every hour and fans out over all sites with digest enabled, checking if the current UTC hour matches each site's configured send hour (timezone-aware). For matching sites, it fetches module data via Admin SDK Firestore queries (mirroring the platform's existing report functions), renders a basic HTML email, and sends it via Resend.

**Tech Stack:** Firebase Functions v7 (Node 22), Firebase Admin SDK, Resend (`resend` npm package), `date-fns-tz` for timezone conversion, TypeScript.

---

## File Map

### New files (functions/)
| File | Responsibility |
|---|---|
| `functions/src/digest/index.ts` | Scheduled function entry; hourly fan-out over enabled sites |
| `functions/src/digest/data.ts` | Admin-SDK data fetchers: POS summary + reservation counts for yesterday |
| `functions/src/digest/render.ts` | `renderDigestEmail()` — assembles subject + HTML from module data |
| `functions/src/digest/sections/pos.ts` | `renderPOSSection()` — HTML fragment for POS data |
| `functions/src/digest/sections/reservations.ts` | `renderReservationsSection()` — HTML fragment for reservation data |
| `functions/src/digest/send.ts` | Resend API wrapper — `sendDigestEmail()` |
| `functions/src/digest/types.ts` | Shared types: `DigestSettings`, `POSSummary`, `ReservationSummary`, `ModuleData` |

### Modified files (functions/)
| File | Change |
|---|---|
| `functions/src/index.ts` | Export `sendDailyDigests` scheduled function |
| `functions/package.json` | Add `resend` and `date-fns-tz` dependencies |

### New files (clicker-platform-v2/)
| File | Responsibility |
|---|---|
| `clicker-platform-v2/app/admin/(dashboard)/settings/notifications/page.tsx` | Digest settings UI: toggle, hour picker, email field |
| `clicker-platform-v2/lib/settings/digest.ts` | Firestore read/write for `digestSettings` field in `settings/general` |

### Modified files (clicker-platform-v2/)
| File | Change |
|---|---|
| `clicker-platform-v2/components/admin/SettingsSubNav.tsx` | Add "Notifications" tab |

---

## Task 1: Install dependencies

**Files:**
- Modify: `functions/package.json`

- [ ] **Step 1: Add resend and date-fns-tz to functions/package.json**

Open `functions/package.json` and update `dependencies`:

```json
{
  "dependencies": {
    "@google-cloud/functions-framework": "^3.5.1",
    "firebase-admin": "^13.6.0",
    "firebase-functions": "^7.0.3",
    "resend": "^4.0.0",
    "date-fns-tz": "^3.2.0",
    "sharp": "0.34.5"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd functions && npm install
```

Expected: `resend` and `date-fns-tz` appear in `node_modules/`.

- [ ] **Step 3: Verify TypeScript can see the types**

```bash
cd functions && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors about `resend` or `date-fns-tz` missing.

- [ ] **Step 4: Commit**

```bash
git add functions/package.json functions/package-lock.json
git commit -m "chore(digest): add resend and date-fns-tz dependencies"
```

---

## Task 2: Define shared types

**Files:**
- Create: `functions/src/digest/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// functions/src/digest/types.ts

export interface DigestSettings {
    enabled: boolean;
    sendHour: number;      // 0–23 in site's local timezone
    timezone: string;      // IANA tz string, e.g. "Asia/Jakarta"
    recipientEmail: string;
}

export interface POSSummary {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    topItems: Array<{ name: string; quantity: number; revenue: number }>;
}

export interface ReservationSummary {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
}

export interface ModuleData {
    pos?: POSSummary;
    reservations?: ReservationSummary;
}

export interface SiteDigestContext {
    siteId: string;
    siteName: string;
    digestSettings: DigestSettings;
    adminUrl: string;  // e.g. https://slug.clicker.id/admin
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd functions && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/digest/types.ts
git commit -m "feat(digest): add shared types"
```

---

## Task 3: Data fetchers (Admin SDK)

These replace the platform's client-SDK report functions with Admin SDK equivalents.

**Files:**
- Create: `functions/src/digest/data.ts`

- [ ] **Step 1: Create data.ts**

```typescript
// functions/src/digest/data.ts
import * as admin from 'firebase-admin';
import { POSSummary, ReservationSummary } from './types';

const db = () => admin.firestore();

/**
 * Returns yesterday's date range (start of day → start of today) in UTC,
 * adjusted so "yesterday" means the calendar day before `now` in `timezone`.
 */
export function getYesterdayRange(timezone: string, now: Date = new Date()): { start: Date; end: Date } {
    const { toZonedTime, fromZonedTime } = require('date-fns-tz');

    const localNow = toZonedTime(now, timezone);
    const localYesterday = new Date(localNow);
    localYesterday.setDate(localNow.getDate() - 1);
    localYesterday.setHours(0, 0, 0, 0);

    const localToday = new Date(localNow);
    localToday.setHours(0, 0, 0, 0);

    return {
        start: fromZonedTime(localYesterday, timezone),
        end: fromZonedTime(localToday, timezone),
    };
}

export async function fetchPOSSummary(siteId: string, start: Date, end: Date): Promise<POSSummary | null> {
    try {
        const coll = db().collection('sites').doc(siteId).collection('modules/byod_pos/orders');
        const snapshot = await coll
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
            .where('createdAt', '<', admin.firestore.Timestamp.fromDate(end))
            .where('status', '==', 'completed')
            .get();

        if (snapshot.empty) return { totalSales: 0, totalOrders: 0, averageOrderValue: 0, topItems: [] };

        const orders = snapshot.docs.map(d => d.data() as { total: number; items: Array<{ name: string; quantity: number; price: number }> });
        const totalSales = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        // Aggregate items
        const itemMap = new Map<string, { quantity: number; revenue: number }>();
        for (const order of orders) {
            for (const item of order.items ?? []) {
                const existing = itemMap.get(item.name) ?? { quantity: 0, revenue: 0 };
                itemMap.set(item.name, {
                    quantity: existing.quantity + (item.quantity ?? 1),
                    revenue: existing.revenue + (item.price ?? 0) * (item.quantity ?? 1),
                });
            }
        }
        const topItems = Array.from(itemMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return { totalSales, totalOrders, averageOrderValue, topItems };
    } catch (err) {
        console.error(`[digest.data] fetchPOSSummary failed for ${siteId}:`, err);
        return null;
    }
}

export async function fetchReservationSummary(siteId: string, start: Date, end: Date): Promise<ReservationSummary | null> {
    try {
        const coll = db().collection('sites').doc(siteId).collection('modules/reservation/bookings');
        const snapshot = await coll
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
            .where('createdAt', '<', admin.firestore.Timestamp.fromDate(end))
            .get();

        if (snapshot.empty) return { total: 0, completed: 0, cancelled: 0, pending: 0 };

        const statuses = snapshot.docs.map(d => (d.data() as { status: string }).status);
        return {
            total: statuses.length,
            completed: statuses.filter(s => s === 'completed').length,
            cancelled: statuses.filter(s => s === 'cancelled').length,
            pending: statuses.filter(s => s === 'pending' || s === 'confirmed').length,
        };
    } catch (err) {
        console.error(`[digest.data] fetchReservationSummary failed for ${siteId}:`, err);
        return null;
    }
}

export async function isModuleEnabledAdmin(siteId: string, moduleId: string): Promise<boolean> {
    try {
        const doc = await db().collection('sites').doc(siteId).collection('settings').doc('modules').get();
        if (!doc.exists) return false;
        const data = doc.data() ?? {};
        return data[moduleId]?.enabled === true;
    } catch {
        return false;
    }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd functions && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/digest/data.ts
git commit -m "feat(digest): add Admin SDK data fetchers for POS and reservations"
```

---

## Task 4: Email section renderers

**Files:**
- Create: `functions/src/digest/sections/pos.ts`
- Create: `functions/src/digest/sections/reservations.ts`

- [ ] **Step 1: Create POS section renderer**

```typescript
// functions/src/digest/sections/pos.ts
import { POSSummary } from '../types';

function formatIDR(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function renderPOSSection(data: POSSummary): string {
    const topItemsHtml = data.topItems.length > 0
        ? data.topItems.map((item, i) =>
            `<tr>
                <td style="padding:4px 8px;color:#666;font-size:13px;">${i + 1}. ${item.name}</td>
                <td style="padding:4px 8px;color:#666;font-size:13px;text-align:right;">${item.quantity} pcs</td>
                <td style="padding:4px 8px;color:#666;font-size:13px;text-align:right;">${formatIDR(item.revenue)}</td>
            </tr>`
          ).join('')
        : `<tr><td colspan="3" style="padding:4px 8px;color:#aaa;font-size:13px;">No items sold</td></tr>`;

    return `
<tr>
  <td style="padding:24px 32px;">
    <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.05em;">POS Summary</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="padding:6px 0;color:#444;font-size:14px;">Revenue</td>
        <td style="padding:6px 0;color:#111;font-size:14px;font-weight:700;text-align:right;">${formatIDR(data.totalSales)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#444;font-size:14px;">Orders</td>
        <td style="padding:6px 0;color:#111;font-size:14px;font-weight:700;text-align:right;">${data.totalOrders}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#444;font-size:14px;">Avg Order Value</td>
        <td style="padding:6px 0;color:#111;font-size:14px;font-weight:700;text-align:right;">${formatIDR(data.averageOrderValue)}</td>
      </tr>
    </table>
    ${data.topItems.length > 0 ? `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Top Items</p>
    <table width="100%" cellpadding="0" cellspacing="0">${topItemsHtml}</table>
    ` : ''}
  </td>
</tr>
<tr><td style="height:1px;background:#eee;"></td></tr>`;
}
```

- [ ] **Step 2: Create Reservations section renderer**

```typescript
// functions/src/digest/sections/reservations.ts
import { ReservationSummary } from '../types';

export function renderReservationsSection(data: ReservationSummary): string {
    return `
<tr>
  <td style="padding:24px 32px;">
    <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.05em;">Reservations</h2>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:6px 0;color:#444;font-size:14px;">Total Bookings</td>
        <td style="padding:6px 0;color:#111;font-size:14px;font-weight:700;text-align:right;">${data.total}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#444;font-size:14px;">Completed</td>
        <td style="padding:6px 0;color:#2d7a4f;font-size:14px;font-weight:700;text-align:right;">${data.completed}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#444;font-size:14px;">Cancelled</td>
        <td style="padding:6px 0;color:#b91c1c;font-size:14px;font-weight:700;text-align:right;">${data.cancelled}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#444;font-size:14px;">Pending / Confirmed</td>
        <td style="padding:6px 0;color:#111;font-size:14px;font-weight:700;text-align:right;">${data.pending}</td>
      </tr>
    </table>
  </td>
</tr>
<tr><td style="height:1px;background:#eee;"></td></tr>`;
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd functions && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/digest/sections/
git commit -m "feat(digest): add POS and reservations email section renderers"
```

---

## Task 5: Email renderer

**Files:**
- Create: `functions/src/digest/render.ts`

- [ ] **Step 1: Create render.ts**

```typescript
// functions/src/digest/render.ts
import { SiteDigestContext, ModuleData } from './types';
import { renderPOSSection } from './sections/pos';
import { renderReservationsSection } from './sections/reservations';

export function renderDigestEmail(
    site: SiteDigestContext,
    date: string,        // "DD MMM YYYY" formatted string
    data: ModuleData
): { subject: string; html: string } {
    const subject = `${site.siteName} — Daily Report, ${date}`;

    const sections = [
        data.pos ? renderPOSSection(data.pos) : '',
        data.reservations ? renderReservationsSection(data.reservations) : '',
    ].join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">
          <!-- Header -->
          <tr>
            <td style="background:#111;padding:24px 32px;">
              <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">${site.siteName}</p>
              <p style="margin:4px 0 0;color:#aaa;font-size:13px;">Daily Report — ${date}</p>
            </td>
          </tr>
          <tr><td style="height:1px;background:#eee;"></td></tr>
          ${sections || `<tr><td style="padding:24px 32px;color:#888;font-size:14px;">No module data available for yesterday.</td></tr>`}
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#aaa;">
                Powered by <strong>Clicker</strong> &nbsp;·&nbsp;
                <a href="${site.adminUrl}" style="color:#aaa;">Open Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return { subject, html };
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd functions && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/digest/render.ts
git commit -m "feat(digest): add email renderer"
```

---

## Task 6: Resend sender wrapper

**Files:**
- Create: `functions/src/digest/send.ts`

- [ ] **Step 1: Create send.ts**

```typescript
// functions/src/digest/send.ts
import { Resend } from 'resend';
import * as functions from 'firebase-functions';

let _resend: Resend | null = null;

function getResend(): Resend {
    if (!_resend) {
        const apiKey = functions.config().resend?.api_key;
        if (!apiKey) throw new Error('resend.api_key not configured in Firebase Functions config');
        _resend = new Resend(apiKey);
    }
    return _resend;
}

export async function sendDigestEmail(params: {
    to: string;
    subject: string;
    html: string;
}): Promise<void> {
    const resend = getResend();
    const { error } = await resend.emails.send({
        from: 'Clicker Digest <digest@mail.clicker.id>',
        to: params.to,
        subject: params.subject,
        html: params.html,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd functions && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/digest/send.ts
git commit -m "feat(digest): add Resend sender wrapper"
```

---

## Task 7: Scheduled function (main orchestrator)

**Files:**
- Create: `functions/src/digest/index.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create digest/index.ts**

```typescript
// functions/src/digest/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { DigestSettings, ModuleData, SiteDigestContext } from './types';
import { getYesterdayRange, fetchPOSSummary, fetchReservationSummary, isModuleEnabledAdmin } from './data';
import { renderDigestEmail } from './render';
import { sendDigestEmail } from './send';

const db = () => admin.firestore();

export const sendDailyDigests = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async () => {
        const now = new Date();
        const currentUtcHour = now.getUTCHours();

        // Fetch all sites with digest enabled
        const sitesSnap = await db().collectionGroup('settings')
            .where('digestSettings.enabled', '==', true)
            .get();

        // Extract siteIds from document paths: sites/{siteId}/settings/general
        const siteIds = sitesSnap.docs
            .filter(doc => doc.ref.path.endsWith('/settings/general'))
            .map(doc => ({
                siteId: doc.ref.parent.parent!.id,
                settings: doc.data() as { digestSettings: DigestSettings; name?: string; slug?: string },
            }));

        if (siteIds.length === 0) {
            console.log('[digest] No sites with digest enabled.');
            return;
        }

        const results = await Promise.allSettled(
            siteIds.map(({ siteId, settings }) =>
                processSiteDigest(siteId, settings, now, currentUtcHour)
            )
        );

        const ok = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[digest] Run complete. ok=${ok} failed=${failed}`);
    });

async function processSiteDigest(
    siteId: string,
    settings: { digestSettings: DigestSettings; name?: string; slug?: string },
    now: Date,
    currentUtcHour: number
): Promise<void> {
    const { digestSettings } = settings;

    // Convert site's sendHour from local timezone → UTC hour
    const localNow = toZonedTime(now, digestSettings.timezone);
    const localHour = localNow.getHours();

    // Check if we should send now (local hour matches configured sendHour)
    if (localHour !== digestSettings.sendHour) return;

    const siteName = settings.name ?? siteId;
    const slug = settings.slug ?? siteId;
    const adminUrl = `https://${slug}.clicker.id/admin`;
    const { start, end } = getYesterdayRange(digestSettings.timezone, now);

    // Format date label in site's local timezone
    const localYesterday = toZonedTime(start, digestSettings.timezone);
    const dateLabel = format(localYesterday, 'd MMM yyyy');

    // Check which modules are enabled and gather data
    const [posEnabled, reservationEnabled] = await Promise.all([
        isModuleEnabledAdmin(siteId, 'byod_pos'),
        isModuleEnabledAdmin(siteId, 'reservation'),
    ]);

    const data: ModuleData = {};

    if (posEnabled) {
        data.pos = (await fetchPOSSummary(siteId, start, end)) ?? undefined;
    }
    if (reservationEnabled) {
        data.reservations = (await fetchReservationSummary(siteId, start, end)) ?? undefined;
    }

    const siteContext: SiteDigestContext = { siteId, siteName, digestSettings, adminUrl };
    const { subject, html } = renderDigestEmail(siteContext, dateLabel, data);

    try {
        await sendDigestEmail({ to: digestSettings.recipientEmail, subject, html });
        await writeDigestLog(siteId, start, { status: 'sent', modulesIncluded: Object.keys(data) });
        console.log(`[digest] Sent for ${siteId}`);
    } catch (err: any) {
        await writeDigestLog(siteId, start, { status: 'failed', error: err.message });
        console.error(`[digest] Send failed for ${siteId}:`, err.message);
        throw err;
    }
}

async function writeDigestLog(
    siteId: string,
    date: Date,
    payload: { status: 'sent' | 'failed'; modulesIncluded?: string[]; error?: string }
): Promise<void> {
    const dateKey = format(date, 'yyyy-MM-dd');
    await db()
        .collection('sites').doc(siteId)
        .collection('digestLogs').doc(dateKey)
        .set({
            ...payload,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
}
```

- [ ] **Step 2: Export from functions/src/index.ts**

Add at the bottom of `functions/src/index.ts`:

```typescript
export { sendDailyDigests } from './digest/index';
```

- [ ] **Step 3: Verify compilation**

```bash
cd functions && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/digest/index.ts functions/src/index.ts
git commit -m "feat(digest): add sendDailyDigests scheduled function"
```

---

## Task 8: Check Firestore module settings path

> **Note:** `isModuleEnabledAdmin` in Task 3 reads `sites/{siteId}/settings/modules`. Verify this is the correct path for module enabled flags before deploying.

**Files:**
- Modify: `functions/src/digest/data.ts` (if path is wrong)

- [ ] **Step 1: Check the actual Firestore path used by the platform**

```bash
grep -rn "settings.*modules\|modules.*enabled\|moduleEnabled" \
  clicker-platform-v2/lib/modules/registry.ts \
  clicker-platform-v2/lib/core/ \
  --include="*.ts" | head -20
```

- [ ] **Step 2: If the path differs, update isModuleEnabledAdmin in functions/src/digest/data.ts**

The function currently reads `sites/{siteId}/settings/modules`. If the platform stores module enabled state elsewhere (e.g., a top-level `modules` collection), update accordingly:

```typescript
// Example if modules are stored at top-level modules/{moduleId} with a siteId field:
export async function isModuleEnabledAdmin(siteId: string, moduleId: string): Promise<boolean> {
    try {
        const doc = await db().collection('modules').doc(moduleId).get();
        if (!doc.exists) return false;
        const data = doc.data() ?? {};
        // adjust to match actual schema
        return data.enabled === true && data.siteId === siteId;
    } catch {
        return false;
    }
}
```

- [ ] **Step 3: Verify compilation after any change**

```bash
cd functions && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit if changed**

```bash
git add functions/src/digest/data.ts
git commit -m "fix(digest): correct module enabled path for Admin SDK"
```

---

## Task 9: Platform-side digest settings library

**Files:**
- Create: `clicker-platform-v2/lib/settings/digest.ts`

- [ ] **Step 1: Create the settings library**

```typescript
// clicker-platform-v2/lib/settings/digest.ts
'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface DigestSettings {
    enabled: boolean;
    sendHour: number;        // 0–23, local time
    timezone: string;        // IANA tz string
    recipientEmail: string;
}

const DEFAULT_DIGEST_SETTINGS: DigestSettings = {
    enabled: false,
    sendHour: 23,
    timezone: 'Asia/Jakarta',
    recipientEmail: '',
};

export async function getDigestSettings(siteId: string): Promise<DigestSettings> {
    const ref = doc(db, 'sites', siteId, 'settings', 'general');
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ...DEFAULT_DIGEST_SETTINGS };
    const data = snap.data();
    return data.digestSettings ?? { ...DEFAULT_DIGEST_SETTINGS };
}

export async function saveDigestSettings(siteId: string, settings: DigestSettings): Promise<void> {
    const ref = doc(db, 'sites', siteId, 'settings', 'general');
    await setDoc(ref, { digestSettings: settings }, { merge: true });
}
```

- [ ] **Step 2: Verify it compiles (run platform lint)**

```bash
cd clicker-platform-v2 && pnpm lint 2>&1 | grep "digest" | head -10
```

Expected: No errors about `lib/settings/digest.ts`.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/settings/digest.ts
git commit -m "feat(digest): add platform-side digest settings library"
```

---

## Task 10: Add Notifications tab to SettingsSubNav

**Files:**
- Modify: `clicker-platform-v2/components/admin/SettingsSubNav.tsx`

- [ ] **Step 1: Add Notifications to the TABS array**

In `clicker-platform-v2/components/admin/SettingsSubNav.tsx`, update the TABS constant:

```typescript
const TABS = [
    { label: 'Account', path: '/admin/settings/account' },
    { label: 'Business', path: '/admin/settings/business' },
    { label: 'Notifications', path: '/admin/settings/notifications' },
] as const;
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd clicker-platform-v2 && pnpm lint 2>&1 | grep "SettingsSubNav" | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/admin/SettingsSubNav.tsx
git commit -m "feat(digest): add Notifications tab to settings subnav"
```

---

## Task 11: Digest settings page UI

**Files:**
- Create: `clicker-platform-v2/app/admin/(dashboard)/settings/notifications/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// clicker-platform-v2/app/admin/(dashboard)/settings/notifications/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { getDigestSettings, saveDigestSettings, DigestSettings } from '@/lib/settings/digest';
import { SettingsSubNav } from '@/components/admin/SettingsSubNav';
import { auth } from '@/lib/firebase';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
    const period = h < 12 ? 'AM' : 'PM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${period}`;
}

export default function NotificationsSettingsPage() {
    const { siteId } = useSite();
    const { canEdit } = useUser();
    const [settings, setSettings] = useState<DigestSettings>({
        enabled: false,
        sendHour: 23,
        timezone: 'Asia/Jakarta',
        recipientEmail: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!siteId) return;
        getDigestSettings(siteId).then(s => {
            setSettings(prev => ({
                ...s,
                recipientEmail: s.recipientEmail || auth.currentUser?.email || '',
            }));
            setLoading(false);
        });
    }, [siteId]);

    async function handleSave() {
        if (!siteId || !canEdit()) return;
        setSaving(true);
        await saveDigestSettings(siteId, settings);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    if (loading) return <div className="max-w-2xl"><SettingsSubNav /><p className="text-sm text-gray-400">Loading…</p></div>;

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Notifications</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm mb-8">Configure your daily activity digest email.</p>

            <SettingsSubNav />

            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
                <h2 className="text-sm font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider mb-6">Daily Digest Email</h2>

                {/* Enable toggle */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-neutral-100 text-sm">Enable daily digest</p>
                        <p className="text-xs text-gray-400 mt-0.5">Receive a summary of yesterday's activity by email.</p>
                    </div>
                    <button
                        onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enabled ? 'bg-brand-dark' : 'bg-gray-200 dark:bg-neutral-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {settings.enabled && (
                    <div className="space-y-4">
                        {/* Send hour */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase mb-1 block">Send time (local)</label>
                            <select
                                value={settings.sendHour}
                                onChange={e => setSettings(s => ({ ...s, sendHour: Number(e.target.value) }))}
                                className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                            >
                                {HOURS.map(h => (
                                    <option key={h} value={h}>{formatHour(h)}</option>
                                ))}
                            </select>
                        </div>

                        {/* Timezone */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase mb-1 block">Timezone</label>
                            <input
                                type="text"
                                value={settings.timezone}
                                onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                                placeholder="Asia/Jakarta"
                                className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                            />
                            <p className="text-xs text-gray-400 mt-1">IANA timezone name, e.g. Asia/Jakarta, Asia/Makassar</p>
                        </div>

                        {/* Recipient email */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase mb-1 block">Recipient email</label>
                            <input
                                type="email"
                                value={settings.recipientEmail}
                                onChange={e => setSettings(s => ({ ...s, recipientEmail: e.target.value }))}
                                className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                            />
                        </div>
                    </div>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving || !canEdit()}
                    className="mt-6 px-5 py-2 bg-brand-dark text-brand-green font-bold text-sm rounded-lg disabled:opacity-50"
                >
                    {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Start dev server and verify the page loads**

```bash
cd clicker-platform-v2 && pnpm dev
```

Navigate to `/admin/settings/notifications` — the page should render with the toggle and, when enabled, the hour/timezone/email fields.

- [ ] **Step 3: Test toggle, fill fields, click Save — verify Firestore gets updated**

In Firebase Console → `sites/{testSiteId}/settings/general` → confirm `digestSettings` object is written with correct values.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/app/admin/\(dashboard\)/settings/notifications/page.tsx
git commit -m "feat(digest): add Notifications settings page"
```

---

## Task 12: Manual test of the full flow

Before deploying, test the scheduled function locally via the Firebase Emulator.

- [ ] **Step 1: Set Resend API key in local Functions config**

```bash
cd functions && firebase functions:config:set resend.api_key="re_YOUR_KEY_HERE"
```

- [ ] **Step 2: Build functions**

```bash
cd functions && npm run build
```

Expected: Compiles to `functions/lib/` with no errors.

- [ ] **Step 3: Start emulator**

```bash
firebase emulators:start --only functions,firestore
```

- [ ] **Step 4: Seed a test site with digestSettings**

In the Firestore emulator UI (localhost:4000), create:
- Document: `sites/testSite123/settings/general`
- Fields:
  ```json
  {
    "name": "Test Cafe",
    "slug": "testcafe",
    "digestSettings": {
      "enabled": true,
      "sendHour": <current local hour>,
      "timezone": "Asia/Jakarta",
      "recipientEmail": "your@email.com"
    }
  }
  ```

Also seed a module enabled doc at `sites/testSite123/settings/modules`:
```json
{ "byod_pos": { "enabled": true } }
```

And add a completed POS order in `sites/testSite123/modules/byod_pos/orders`:
```json
{
  "status": "completed",
  "total": 50000,
  "createdAt": <yesterday timestamp>,
  "items": [{ "name": "Nasi Goreng", "quantity": 2, "price": 25000 }]
}
```

- [ ] **Step 5: Trigger the function manually**

```bash
firebase functions:shell
# In the shell:
sendDailyDigests({})
```

Expected: Console logs `[digest] Sent for testSite123`. Email arrives at recipient.

- [ ] **Step 6: Verify digestLogs doc written**

In Firestore emulator: `sites/testSite123/digestLogs/{yesterday-date}` should have `{ status: 'sent', modulesIncluded: ['pos'] }`.

- [ ] **Step 7: Test failure path**

Remove the Resend API key from config, re-trigger — confirm `digestLogs` doc has `{ status: 'failed', error: '...' }` and no other sites are affected.

- [ ] **Step 8: Commit any fixes found during testing, then final commit**

```bash
git add -p
git commit -m "fix(digest): address issues found in emulator testing"
```

---

## Task 13: Deploy

- [ ] **Step 1: Deploy functions to staging**

```bash
firebase deploy --only functions --project clicker-universe-stagging
```

Expected: `sendDailyDigests` appears in Firebase Console → Functions with schedule "every 1 hours".

- [ ] **Step 2: Set Resend API key in staging**

```bash
firebase functions:config:set resend.api_key="re_YOUR_STAGING_KEY" --project clicker-universe-stagging
firebase deploy --only functions --project clicker-universe-stagging
```

(Config changes require a redeploy.)

- [ ] **Step 3: Enable digest for a staging test site via the UI**

Navigate to the staging platform → Settings → Notifications, enable digest, set sendHour to the next UTC hour, save.

- [ ] **Step 4: Wait for the scheduled run and verify email arrives**

Check Firebase Console → Functions → Logs for `[digest] Sent for <siteId>`.

- [ ] **Step 5: Deploy to production once staging passes**

```bash
firebase deploy --only functions --project clicker-universe
firebase functions:config:set resend.api_key="re_YOUR_PROD_KEY" --project clicker-universe
firebase deploy --only functions --project clicker-universe
```

---

## Self-Review

**Spec coverage check:**
- ✅ Firebase Scheduled Function hourly fan-out → Task 7
- ✅ Timezone-aware sendHour matching → Task 7 (`processSiteDigest`)
- ✅ POS data fetch (Admin SDK) → Task 3
- ✅ Reservation data fetch (Admin SDK) → Task 3
- ✅ Module enabled check → Task 3 (`isModuleEnabledAdmin`)
- ✅ "Yesterday" in site's timezone → Task 3 (`getYesterdayRange`)
- ✅ renderDigestEmail assembles sections → Task 5
- ✅ POS section (revenue, orders, AOV, top 5 items) → Task 4
- ✅ Reservations section (total, completed, cancelled, pending) → Task 4
- ✅ Resend send wrapper → Task 6
- ✅ digestLogs written on success and failure → Task 7 (`writeDigestLog`)
- ✅ Promise.allSettled fan-out → Task 7
- ✅ DigestSettings in settings/general → Task 9
- ✅ Admin settings UI (toggle, hour picker, email) → Task 11
- ✅ Notifications tab in SettingsSubNav → Task 10
- ✅ Deploy steps → Task 13
- ✅ Module path verification → Task 8 (explicit verification step)

**Type consistency:**
- `DigestSettings` defined in `functions/src/digest/types.ts` (Task 2) and re-defined in `lib/settings/digest.ts` (Task 9) — intentional separation (server types vs client types); shapes are identical.
- `POSSummary.topItems` defined in Task 2, consumed correctly in Task 4 `renderPOSSection`.
- `isModuleEnabledAdmin(siteId, moduleId)` defined in Task 3, called with `('byod_pos')` and `('reservation')` in Task 7 — consistent.

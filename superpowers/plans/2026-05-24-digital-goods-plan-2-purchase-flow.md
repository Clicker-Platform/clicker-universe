# Digital Goods Module — Plan 2: Purchase Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CLAUDE.md Rule 9 (mandatory):** Before writing **any** admin file in this plan, open the analogous file in `lib/modules/promo/` and mirror its conventions. For public buyer-facing pages, mirror `app/catalog/` and `app/[tenant]/` patterns. Do **not** infer styling from spec snippets.

**Spec:** `superpowers/specs/2026-05-23-digital-goods-module-design.md`
**Predecessor:** Plan 1 — Foundation (merged to `dev` as `25acf19`)
**Branch:** `feat/digital-goods-plan-2`

**Goal:** Build the complete buyer-facing purchase flow on top of Plan 1's admin scaffolding. After Plan 2 ships, a buyer can discover a product, log in via magic link, submit a manual-transfer order, get notified when the tenant confirms payment, and access purchased PDFs via short-lived signed URLs (or YouTube embeds).

**Architecture:** Buyer identity owned by `digital_goods` (own `buyers/{uid}` collection, NOT a dependency on the membership module — per spec §5 / §11). Server-side guards via Firebase Admin SDK for signed-URL issuance and order state transitions. Manual-transfer payment with tenant-side confirmation via a slide-over in the admin orders panel (mirroring Plan 1's product slide-over). Emails via existing platform `sendEmail()` helper. Live order status via Firestore `onSnapshot`.

**Tech Stack:** Next.js 16 App Router (server + client components), Firebase Auth magic-link (already wired), Firebase Firestore (client SDK + Admin SDK), Firebase Storage (Admin SDK for signed URLs), Vitest, TypeScript, Tailwind, lucide-react, existing `lib/email/sendEmail()`.

**Outcome at end of Plan 2:** All routes from spec §8 are live and functional. Tenant admin can see and confirm orders. Buyer can complete a purchase end-to-end. No loyalty integration yet (Plan 3). No PostHog events yet (Plan 3).

---

## File Structure

### New files (data layer + API)

| Path | Responsibility |
| --- | --- |
| `lib/modules/digital_goods/server-api.ts` | Server-only Firestore + Storage operations using Admin SDK (signed-URL issuance, buyer auto-provision via Admin, order paid-confirm transactional writes). Imports `firebase-admin` and is never imported by client components. |
| `lib/modules/digital_goods/buyers.ts` | Client-side buyer-record CRUD: `getBuyer(siteId, uid)`, `upsertBuyer(siteId, data)`. |
| `lib/modules/digital_goods/orders.ts` | Client-side order CRUD: `createOrder()`, `getOrder()`, `listOrders()`, `subscribeOrder()` for live status. |
| `lib/modules/digital_goods/library.ts` | Client-side library CRUD: `getLibraryForBuyer()`, `getLibraryEntry()`, `hasLibraryEntryForProduct()`. |
| `lib/modules/digital_goods/__tests__/orders.test.ts` | Vitest for order helpers (status transitions, snapshot serialization). |

### New files (public buyer surfaces — block-based, NOT standalone /store)

**Decision (vs spec §12):** The buyer-facing catalog is implemented as a **Canvas Studio block** (`digital_goods:ProductGrid`), NOT a standalone `/store` route. The lesson from `byod_pos` is that standalone tenant-facing pages get abandoned because tenants want full layout control. Activating the module auto-creates a Custom Page named "Store" with the block pre-placed, so the tenant gets a working storefront out of the box but can rearrange, rename, theme, or move the block anywhere. Product detail and checkout remain as routes because they're transactional flows, not browse surfaces.

| Path | Responsibility |
| --- | --- |
| `components/blocks/public/ProductGridBlock.tsx` | Block renderer — server component that fetches published products for current tenant and renders a responsive grid. Reads block props: `title?`, `subtitle?`, `limit?`, `columns?`. |
| `components/admin/blocks/forms/ProductGridBlockForm.tsx` | Admin block-form — fields for title, subtitle, limit, columns. Standard `BlockFormRenderer` pattern. |
| `lib/modules/digital_goods/auto-page.ts` | Server-only — `ensureStorePageExists(siteId)` creates a Custom Page with id `digital-goods-store` containing one `digital_goods:ProductGrid` block, if absent. Idempotent. |
| `app/store/[slug]/page.tsx` | Server component — product detail page with "Buy Now" CTA. Route remains because it's the canonical deep-link target from the block's product cards. |
| `app/store/[slug]/StoreProductClient.tsx` | Client component — handles "Buy Now" click, login redirect, "Already in your library" guard. |
| `app/store/[slug]/checkout/page.tsx` | Server component — auth-gated checkout shell. Resolves session, loads product + settings, renders client. |
| `app/store/[slug]/checkout/CheckoutClient.tsx` | Client component — payment instructions, "Saya sudah transfer" button, creates order via server action. |
| `app/library/page.tsx` | Server component — buyer's purchased items grid. |
| `app/library/[entryId]/page.tsx` | Server component — single purchase detail. Shows download CTA for PDF or YouTube embed. |
| `app/library/[entryId]/LibraryEntryClient.tsx` | Client component — "Download PDF" button calls the signed-URL endpoint. |
| `app/library/orders/[orderId]/page.tsx` | Server component — order status page shell. |
| `app/library/orders/[orderId]/OrderStatusClient.tsx` | Client component — live status via `onSnapshot`, payment instructions repeated, optional buyer-note update. |
| `app/api/digital-goods/checkout/route.ts` | Server action / POST endpoint — receives "Saya sudah transfer" submission, snapshots payment instructions, creates Order doc with `status: awaiting_confirmation`, fires tenant email. |
| `app/api/digital-goods/files/[fileId]/route.ts` | Server endpoint — issues 15-min signed Firebase Storage URL after verifying buyer owns the file via library entry. |

### New files (admin orders)

| Path | Responsibility |
| --- | --- |
| `lib/modules/digital_goods/admin/OrdersListPage.tsx` | Admin orders list. Mirrors promo's list-page pattern: header, filters, table, slide-over for detail. |
| `lib/modules/digital_goods/admin/components/OrderDetailForm.tsx` | Slide-over — order detail panel with "Mark as paid" / "Cancel" actions. Mirrors `ProductForm.tsx` slide-over chrome. |

### New files (emails)

| Path | Responsibility |
| --- | --- |
| `lib/modules/digital_goods/emails.ts` | Two helper functions: `sendNewOrderTenantEmail()`, `sendOrderPaidBuyerEmail()`. Wraps platform `sendEmail()` with module-specific template aliases and variable mapping. |

### Modified files

| Path | Change |
| --- | --- |
| `lib/modules/digital_goods/constants.ts` | Add `ROUTES.adminOrders`, `ROUTES.publicStore`, `ROUTES.buyerLibrary`. Add `STORAGE_FOLDER_PRODUCT_FILES` constant. Add `SIGNED_URL_TTL_SECONDS = 15 * 60`. Add email template alias keys. |
| `lib/modules/definitions.ts` | Add `Orders` admin route to `digital_goods` adminRoutes. |
| `lib/modules/components.tsx` | Register `digital_goods:OrdersList` componentKey → `OrdersListPage`. |
| `scripts/seed-modules.ts` | Update `digital_goods` adminRoutes to include Orders. |
| `firestore.rules` | Add rules for `modules/digital_goods/buyers/{uid}`, `orders/{id}`, `library/{id}` per spec §6. |
| `storage.rules` | Tighten reads for `sites/{siteId}/modules/digital_goods/products/files/**` — block public reads (signed URLs only). |
| `lib/email/config.ts` | Register two new template aliases: `digitalGoodsNewOrderTenant`, `digitalGoodsOrderPaidBuyer`. |

### Out of Plan 2 (deferred to Plan 3)
- Loyalty integration (optional `addPoints` call on order paid)
- PostHog events
- WhatsApp tenant notifications
- Promo/discount code integration
- Refund workflow

---

## Phase 1 — Buyer identity + access plumbing (Tasks 1–4, plus 4b login route)

### Task 1: Extend constants for Plan 2

**Files:**
- Modify: `lib/modules/digital_goods/constants.ts`

- [ ] **Step 1: Append the new constants**

Open `lib/modules/digital_goods/constants.ts`. After the existing exports, add:

```ts
// Plan 2 — Public buyer routes
export const PUBLIC_ROUTES = {
  store:      '/store',
  storeItem:  '/store',                  // append /[slug]
  checkout:   '/store',                  // append /[slug]/checkout
  library:    '/library',
  libraryEntry:  '/library',             // append /[entryId]
  orderStatus:   '/library/orders',      // append /[orderId]
  login:      '/store/login',            // OWNED BY digital_goods. NOT /member/login (which lives in the loyalty module by accident — see CLAUDE.md rule 10).
  loginVerify:'/store/login/verify',
} as const;

// Plan 2 — Storage subfolders
export const STORAGE_FOLDER_PRODUCT_FILES = `${STORAGE_FOLDER_PRODUCTS}/files`;

// Plan 2 — Signed URL TTL for PDF downloads (15 minutes)
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

// Plan 2 — Email template alias KEYS (looked up via getTemplateAliases())
export const EMAIL_ALIAS_KEYS = {
  newOrderTenant: 'digitalGoodsNewOrderTenant',
  orderPaidBuyer: 'digitalGoodsOrderPaidBuyer',
} as const;

// Plan 2 — Admin Orders route added to ROUTES
// (ROUTES const is updated by extending the existing object; not duplicated here.)
```

Then update the existing `ROUTES` export to include the orders route. Locate `ROUTES` and add `orders: '/admin/digital-goods/orders',` between `list` and `settings`. Final shape:

```ts
export const ROUTES = {
  list:     '/admin/digital-goods',
  orders:   '/admin/digital-goods/orders',
  settings: '/admin/digital-goods/settings',
} as const;
```

- [ ] **Step 2: TypeScript check**

```bash
cd clicker-platform-v2 && pnpm exec tsc --noEmit 2>&1 | grep -E "digital_goods" | head
```

Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/modules/digital_goods/constants.ts
git commit -m "feat(digital_goods): add Plan 2 constants (public routes, storage, signed URL TTL)"
```

---

### Task 2: Buyer record API (client-side)

**Files:**
- Create: `lib/modules/digital_goods/buyers.ts`

- [ ] **Step 1: Write the file**

```ts
// Digital Goods Module — Buyer identity (Plan 2)
// Digital_goods owns its own buyer record. No dependency on the membership module.

import {
  collection, doc, getDoc, setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_BUYERS } from './constants';
import type { DigitalGoodsBuyer } from './types';

export async function getBuyer(siteId: string, uid: string): Promise<DigitalGoodsBuyer | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_BUYERS, uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as DigitalGoodsBuyer;
}

// Upsert: create if absent, merge fields if present. Called from client on first authed visit
// (server-side equivalent lives in server-api.ts).
export async function upsertBuyer(
  siteId: string,
  uid: string,
  data: { email: string; fullName?: string }
): Promise<void> {
  const ref = doc(db, 'sites', siteId, COLLECTION_BUYERS, uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await setDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } else {
    await setDoc(ref, {
      uid,
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "digital_goods" | head
```

Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/modules/digital_goods/buyers.ts
git commit -m "feat(digital_goods): buyer record API (client-side)"
```

---

### Task 3: Order + Library APIs (client-side, with TDD on status transitions)

**Files:**
- Create: `lib/modules/digital_goods/orders.ts`
- Create: `lib/modules/digital_goods/library.ts`
- Create: `lib/modules/digital_goods/__tests__/orders.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/modules/digital_goods/__tests__/orders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { canTransition, OrderStatus } from '../orders';

describe('canTransition', () => {
  it('allows pending → awaiting_confirmation', () => {
    expect(canTransition('pending', 'awaiting_confirmation')).toBe(true);
  });

  it('allows awaiting_confirmation → paid', () => {
    expect(canTransition('awaiting_confirmation', 'paid')).toBe(true);
  });

  it('allows awaiting_confirmation → cancelled', () => {
    expect(canTransition('awaiting_confirmation', 'cancelled')).toBe(true);
  });

  it('blocks paid → cancelled (no refunds in MVP)', () => {
    expect(canTransition('paid', 'cancelled')).toBe(false);
  });

  it('blocks paid → awaiting_confirmation', () => {
    expect(canTransition('paid', 'awaiting_confirmation')).toBe(false);
  });

  it('blocks cancelled → paid', () => {
    expect(canTransition('cancelled', 'paid')).toBe(false);
  });

  it('blocks pending → paid (must go through awaiting_confirmation first)', () => {
    expect(canTransition('pending', 'paid')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm vitest run lib/modules/digital_goods/__tests__/orders.test.ts
```

Expected: FAIL — "Cannot find module '../orders'".

- [ ] **Step 3: Implement `orders.ts`**

Create `lib/modules/digital_goods/orders.ts`:

```ts
// Digital Goods Module — Orders (Plan 2 client-side API)
// Server-only writes that touch payment state live in server-api.ts.

import {
  collection, doc, getDoc, getDocs, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_ORDERS } from './constants';
import type { DigitalOrder, OrderStatus, PaymentInstructions, ProductSnapshot } from './types';

// Re-export OrderStatus so test file can import from here
export type { OrderStatus };

// Status transition table (used by both client UI and server confirm endpoint)
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === 'pending'                 && to === 'awaiting_confirmation') return true;
  if (from === 'awaiting_confirmation'   && to === 'paid')                  return true;
  if (from === 'awaiting_confirmation'   && to === 'cancelled')             return true;
  return false;
}

export async function getOrder(siteId: string, orderId: string): Promise<DigitalOrder | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_ORDERS, orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DigitalOrder;
}

export async function listOrders(siteId: string): Promise<DigitalOrder[]> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_ORDERS),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalOrder));
}

export async function listOrdersForBuyer(siteId: string, buyerId: string): Promise<DigitalOrder[]> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_ORDERS),
    where('buyerId', '==', buyerId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalOrder));
}

// Live subscription for order status page (Plan 2: buyer order status, admin orders list refresh)
export function subscribeOrder(
  siteId: string,
  orderId: string,
  cb: (order: DigitalOrder | null) => void,
): Unsubscribe {
  const ref = doc(db, 'sites', siteId, COLLECTION_ORDERS, orderId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) cb(null);
    else cb({ id: snap.id, ...snap.data() } as DigitalOrder);
  });
}

// Create order — called from checkout server action only. Client never calls directly.
// Exposed here for typing convenience; security rules block client writes to orders/*.
export type NewOrderInput = {
  buyerId: string;
  productId: string;
  productSnapshot: ProductSnapshot;
  amount: number;
  paymentInstructions: PaymentInstructions;
  buyerNote?: string;
};

export async function createOrderClient(siteId: string, input: NewOrderInput): Promise<string> {
  // NOTE: rules will block this in production; use the server endpoint. Kept here for tests.
  const ref = await addDoc(collection(db, 'sites', siteId, COLLECTION_ORDERS), {
    ...input,
    currency: 'IDR',
    paymentMethod: 'manual_transfer',
    status: 'awaiting_confirmation',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm vitest run lib/modules/digital_goods/__tests__/orders.test.ts
```

Expected: 7/7 PASS.

- [ ] **Step 5: Implement `library.ts`**

Create `lib/modules/digital_goods/library.ts`:

```ts
// Digital Goods Module — Library (Plan 2 client-side reads)
// Server-only writes (creating library entries on order paid) live in server-api.ts.

import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_LIBRARY } from './constants';
import type { LibraryEntry } from './types';

export async function getLibraryEntry(siteId: string, entryId: string): Promise<LibraryEntry | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_LIBRARY, entryId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as LibraryEntry;
}

export async function getLibraryForBuyer(siteId: string, buyerId: string): Promise<LibraryEntry[]> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_LIBRARY),
    where('buyerId', '==', buyerId),
    orderBy('purchasedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryEntry));
}

// "Already purchased" guard for product detail page.
export async function hasLibraryEntryForProduct(
  siteId: string, buyerId: string, productId: string,
): Promise<LibraryEntry | null> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_LIBRARY),
    where('buyerId', '==', buyerId),
    where('productId', '==', productId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as LibraryEntry;
}
```

- [ ] **Step 6: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "digital_goods" | head
```

Expected: empty.

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/lib/modules/digital_goods/orders.ts clicker-platform-v2/lib/modules/digital_goods/library.ts clicker-platform-v2/lib/modules/digital_goods/__tests__/orders.test.ts
git commit -m "feat(digital_goods): orders + library client APIs with status-transition tests"
```

---

### Task 4: Server-only API + signed-URL endpoint stub

**Files:**
- Create: `lib/modules/digital_goods/server-api.ts`
- Create: `app/api/digital-goods/files/[fileId]/route.ts`

- [ ] **Step 1: Write `server-api.ts`**

Create `lib/modules/digital_goods/server-api.ts`:

```ts
// Digital Goods Module — Server-only operations.
// Imports firebase-admin and MUST NEVER be imported by client components.
// All payment-state mutations live here; client only reads.

import 'server-only';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  COLLECTION_BUYERS, COLLECTION_ORDERS, COLLECTION_LIBRARY,
  SIGNED_URL_TTL_SECONDS,
} from './constants';
import { canTransition } from './orders';
import type {
  DigitalGoodsBuyer, DigitalOrder, LibraryEntry,
  PaymentInstructions, ProductSnapshot,
} from './types';

// --- Buyer auto-provision (called from server actions on first authed visit) ---

export async function upsertBuyerAdmin(
  siteId: string,
  uid: string,
  data: { email: string; fullName?: string },
): Promise<void> {
  const ref = adminDb.doc(`sites/${siteId}/${COLLECTION_BUYERS}/${uid}`);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await ref.set({
      uid, ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function getBuyerAdmin(siteId: string, uid: string): Promise<DigitalGoodsBuyer | null> {
  const snap = await adminDb.doc(`sites/${siteId}/${COLLECTION_BUYERS}/${uid}`).get();
  if (!snap.exists) return null;
  return { uid, ...snap.data() } as DigitalGoodsBuyer;
}

// --- Create order (called from checkout server action) ---

export type CreateOrderInput = {
  buyerId: string;
  productId: string;
  productSnapshot: ProductSnapshot;
  amount: number;
  paymentInstructions: PaymentInstructions;
  buyerNote?: string;
};

export async function createOrderAdmin(siteId: string, input: CreateOrderInput): Promise<string> {
  const ref = adminDb.collection(`sites/${siteId}/${COLLECTION_ORDERS}`).doc();
  await ref.set({
    ...input,
    currency: 'IDR',
    paymentMethod: 'manual_transfer',
    status: 'awaiting_confirmation',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// --- Confirm payment (called from admin "Mark as paid" action) ---

export type ConfirmPaidInput = {
  orderId: string;
  confirmedBy: string;
  paymentRef?: string;
};

export async function confirmOrderPaidAdmin(
  siteId: string, input: ConfirmPaidInput,
): Promise<{ libraryEntryId: string; order: DigitalOrder }> {
  const orderRef = adminDb.doc(`sites/${siteId}/${COLLECTION_ORDERS}/${input.orderId}`);
  const libraryRef = adminDb.collection(`sites/${siteId}/${COLLECTION_LIBRARY}`).doc();

  const result = await adminDb.runTransaction(async tx => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error('Order not found.');
    const order = { id: orderSnap.id, ...orderSnap.data() } as DigitalOrder;

    if (!canTransition(order.status, 'paid')) {
      throw new Error(`Cannot transition order from ${order.status} to paid.`);
    }

    // Snapshot for library entry — derive from order.productSnapshot
    const librarySnapshot = {
      title: order.productSnapshot.title,
      coverImage: order.productSnapshot.coverImage,
      type: order.productSnapshot.type,
      contentKind: order.productSnapshot.contentKind,
    };

    tx.update(orderRef, {
      status: 'paid',
      confirmedBy: input.confirmedBy,
      confirmedAt: FieldValue.serverTimestamp(),
      paymentRef: input.paymentRef ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(libraryRef, {
      buyerId: order.buyerId,
      productId: order.productId,
      orderId: order.id,
      productSnapshot: librarySnapshot,
      purchasedAt: FieldValue.serverTimestamp(),
    });

    return { order: { ...order, status: 'paid' as const }, libraryEntryId: libraryRef.id };
  });

  return result;
}

// --- Cancel order ---

export async function cancelOrderAdmin(
  siteId: string, orderId: string,
): Promise<void> {
  const ref = adminDb.doc(`sites/${siteId}/${COLLECTION_ORDERS}/${orderId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Order not found.');
  const order = snap.data() as DigitalOrder;
  if (!canTransition(order.status, 'cancelled')) {
    throw new Error(`Cannot cancel order in ${order.status} state.`);
  }
  await ref.update({
    status: 'cancelled',
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// --- Signed URL issuance ---
// Verifies the buyer owns the file (via library entry referencing the parent product)
// before issuing a short-lived URL.

export async function issueSignedUrlForFile(
  siteId: string, buyerUid: string, productId: string, storagePath: string,
): Promise<string> {
  // Verify buyer has a library entry for this product
  const librarySnap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('buyerId', '==', buyerUid)
    .where('productId', '==', productId)
    .limit(1)
    .get();

  if (librarySnap.empty) throw new Error('forbidden');

  // Verify the requested storagePath belongs to the product
  // (productSnapshot in library entry doesn't carry file paths;
  //  but we can defend by requiring the path matches the expected prefix)
  const expectedPrefix = `sites/${siteId}/modules/digital_goods/products/`;
  if (!storagePath.startsWith(expectedPrefix)) throw new Error('forbidden');

  const file = adminStorage.bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error('not_found');

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return url;
}
```

- [ ] **Step 2: Write the signed-URL route**

Create `app/api/digital-goods/files/[fileId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { issueSignedUrlForFile } from '@/lib/modules/digital_goods/server-api';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  // `fileId` is unused in MVP; we accept the storagePath in the body and verify against the library.
  // Future: lookup file metadata by fileId for extra defense.
  await params;

  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { productId, storagePath } = body as { productId?: string; storagePath?: string };
  if (!productId || !storagePath) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  try {
    const url = await issueSignedUrlForFile(siteId, decoded.uid, productId, storagePath);
    return NextResponse.json({ url });
  } catch (e: any) {
    const msg = e?.message ?? 'unknown';
    if (msg === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    logger.error('digital_goods.signed_url.failed', { siteId, error: e });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|files/.fileId.)" | head
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/modules/digital_goods/server-api.ts clicker-platform-v2/app/api/digital-goods/files/
git commit -m "feat(digital_goods): server-only API + signed-URL endpoint"
```

---

### Task 4b: Buyer login route (digital_goods-owned)

> **CLAUDE.md rule 10 — NON-NEGOTIABLE:** This task builds digital_goods's OWN login UI. It must NOT import from `lib/modules/membership/`. It must NOT redirect to `/member/login`. It must NOT call any membership facade. The membership module is loyalty-only. The fact that an existing `/member/login` page lives in membership's code is a historical accident — we are deliberately NOT reusing it.
>
> Firebase Auth is platform-level; this route consumes it directly via the platform's `lib/firebase.ts` and `lib/firebase-admin.ts`. Mirror the **shape** of the existing `/member/login` flow (magic-link send + verify pattern) **without copying its imports**. Write fresh code that lives entirely within `digital_goods`.

**Files:**

- Create: `app/store/login/page.tsx` — server component that renders the login form (delegates to client component below).
- Create: `app/store/login/LoginClient.tsx` — client component, magic-link form (email input + send).
- Create: `app/store/login/verify/page.tsx` — client component that completes `signInWithEmailLink`, creates the `buyers/{uid}` record server-side via the existing `/api/digital-goods/checkout` server endpoint (or a dedicated `/api/digital-goods/buyer/init` endpoint — choose one and stick with it; recommended: dedicated endpoint), then redirects to the `?next` URL.
- Create: `app/api/digital-goods/buyer/init/route.ts` — POST endpoint that takes the freshly minted Firebase session, calls `upsertBuyerAdmin`, returns the buyer doc.

### Step 1: Verify nothing is imported from membership module

Before writing any code, confirm the rule:

```bash
echo "Files about to be created must NOT import from membership. Verify after creation:"
grep -rn "from '@/lib/modules/membership" app/store/login/ app/api/digital-goods/buyer/ 2>/dev/null && echo "FAIL — coupling detected" || echo "OK — no coupling"
```

(The grep returns nothing because the files don't exist yet. After Step 4, re-run and confirm "OK".)

### Step 2: Write `app/store/login/page.tsx`

```tsx
import { Suspense } from 'react';
import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export default function StoreLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow border border-gray-200 p-8">
        <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
          <LoginClient />
        </Suspense>
      </div>
    </main>
  );
}
```

### Step 3: Write `app/store/login/LoginClient.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';

export function LoginClient() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || PUBLIC_ROUTES.store;

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'INPUT' | 'SENT'>('INPUT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Email diperlukan.'); return; }
    setSubmitting(true); setError(null);
    try {
      const verifyUrl = `${window.location.origin}${PUBLIC_ROUTES.loginVerify}?next=${encodeURIComponent(next)}`;
      await sendSignInLinkToEmail(auth, email, {
        url: verifyUrl,
        handleCodeInApp: true,
      });
      window.localStorage.setItem('digitalGoodsEmailForSignIn', email);
      setStep('SENT');
    } catch (e: any) {
      logger.error('digital_goods.login.send.failed', { error: e });
      setError(e?.message ?? 'Failed to send login link.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'SENT') {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-green-600 mb-3" size={32} />
        <h1 className="text-xl font-bold text-gray-900">Cek email Anda</h1>
        <p className="text-sm text-gray-600 mt-2">Kami sudah mengirim link login ke <strong>{email}</strong>. Klik link tersebut untuk masuk.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <Mail className="mx-auto text-gray-400 mb-2" size={28} />
        <h1 className="text-2xl font-bold text-gray-900">Masuk</h1>
        <p className="text-sm text-gray-500 mt-1">Kami akan kirim link login ke email Anda.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-studio-blue text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="animate-spin w-4 h-4" />}
        Kirim link login
      </button>
    </form>
  );
}
```

### Step 4: Write `app/store/login/verify/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';

export default function StoreLoginVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || PUBLIC_ROUTES.store;
  const [status, setStatus] = useState<'WORKING' | 'ERROR'>('WORKING');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          throw new Error('Invalid or expired link.');
        }
        let email = window.localStorage.getItem('digitalGoodsEmailForSignIn');
        if (!email) {
          email = window.prompt('Confirm your email to complete sign-in:');
          if (!email) throw new Error('Email required.');
        }
        const result = await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem('digitalGoodsEmailForSignIn');

        // Tell the server to create the buyer record + set the session cookie
        const idToken = await result.user.getIdToken();
        const res = await fetch('/api/digital-goods/buyer/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('Failed to initialize buyer session.');

        router.replace(next);
      } catch (e: any) {
        logger.error('digital_goods.login.verify.failed', { error: e });
        setError(e?.message ?? 'Failed to complete sign-in.');
        setStatus('ERROR');
      }
    })();
  }, [next, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow border border-gray-200 p-8 text-center">
        {status === 'WORKING' ? (
          <>
            <Loader2 className="animate-spin mx-auto text-studio-blue mb-3" size={32} />
            <p className="text-sm text-gray-600">Memverifikasi...</p>
          </>
        ) : (
          <>
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <a href={PUBLIC_ROUTES.login} className="text-sm text-studio-blue underline">Kembali ke login</a>
          </>
        )}
      </div>
    </main>
  );
}
```

### Step 5: Write `app/api/digital-goods/buyer/init/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { upsertBuyerAdmin } from '@/lib/modules/digital_goods/server-api';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { idToken } = body as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch (e) {
    logger.error('digital_goods.buyer.init.verify.failed', { siteId, error: e });
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  // Auto-provision the buyer record
  await upsertBuyerAdmin(siteId, decoded.uid, {
    email: decoded.email ?? '',
  });

  // Mint a session cookie so subsequent server requests can verify
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
  });
  const cookieStore = await cookies();
  cookieStore.set('__session', sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true, uid: decoded.uid });
}
```

### Step 6: Verify no coupling

```bash
grep -rn "from '@/lib/modules/membership" app/store/login/ app/api/digital-goods/buyer/ 2>/dev/null && echo "FAIL — coupling detected" || echo "OK — no coupling"
```

Expected: `OK — no coupling`.

```bash
grep -rn "/member/login" app/store/login/ app/api/digital-goods/buyer/ 2>/dev/null && echo "FAIL — references membership-owned route" || echo "OK"
```

Expected: `OK`.

### Step 7: TypeScript check

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|store/login|buyer/init)" | head
```

Expected: empty.

### Step 8: Commit

```bash
git add clicker-platform-v2/app/store/login/ clicker-platform-v2/app/api/digital-goods/buyer/
git commit -m "feat(digital_goods): self-owned magic-link login route (no membership coupling)"
```

---

## Phase 2 — Public store block + product detail (Tasks 5–7)

### Task 5: ProductGrid block + auto-page creation

Per CLAUDE.md rule 9 — before writing this task, READ the `create_block` skill end-to-end and at least one reference block (e.g. `components/blocks/public/FeatureCardsBlock.tsx` for grid layout, `components/blocks/public/ProductsBlock.tsx` for fetching tenant data). The 7 touchpoints from the `create_block` skill apply here.

**Files:**

- Create: `components/blocks/public/ProductGridBlock.tsx`
- Create: `components/admin/blocks/forms/ProductGridBlockForm.tsx`
- Create: `lib/modules/digital_goods/auto-page.ts`
- Modify: `data/mockData.ts` (add `digital_goods_product_grid` to `BlockType` if string-typed enum is closed; otherwise no change)
- Modify: `components/blocks/BlockRenderer.tsx` (register the block renderer)
- Modify: `components/admin/blocks/BlockFormRenderer.tsx` (register the block form)
- Modify: `lib/modules/digital_goods/server-api.ts` (export `ensureStorePageExists` call from Task 4 — actually we'll add a new file `auto-page.ts` for separation)

> **Read first (Rule 9):** Run `pnpm exec ls components/blocks/public/ | head` to see existing block names. Read `components/blocks/public/FeatureCardsBlock.tsx` for grid layout. Read `components/blocks/public/ProductsBlock.tsx` for tenant-data fetch pattern. Read the `create_block` skill's 7-touchpoint list before writing.

### Step 1: Write the block renderer

Create `components/blocks/public/ProductGridBlock.tsx`:

```tsx
import Link from 'next/link';
import { headers } from 'next/headers';
import { ShoppingBag } from 'lucide-react';
import { adminDb } from '@/lib/firebase-admin';
import { COLLECTION_PRODUCTS } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct } from '@/lib/modules/digital_goods/types';

export interface ProductGridBlockData {
  title?: string;
  subtitle?: string;
  limit?: number;     // max products to show (default 12)
  columns?: 2 | 3 | 4; // default 3
}

async function fetchProducts(siteId: string, limit: number): Promise<DigitalProduct[]> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_PRODUCTS}`)
    .where('status', '==', 'published')
    .orderBy('publishedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalProduct));
}

export default async function ProductGridBlock({ data }: { data: ProductGridBlockData }) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';
  const limit = data.limit ?? 12;
  const columns = data.columns ?? 3;

  const products = await fetchProducts(siteId, limit);

  const gridCols = columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto px-4">
        {(data.title || data.subtitle) && (
          <header className="mb-8 text-center">
            {data.title && <h2 className="text-3xl font-bold">{data.title}</h2>}
            {data.subtitle && <p className="text-sm text-gray-500 mt-2">{data.subtitle}</p>}
          </header>
        )}
        {products.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
            <ShoppingBag size={32} className="mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 font-medium">No products yet</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
            {products.map(p => (
              <Link
                key={p.id}
                href={`/store/${p.slug}`}
                className="block rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition bg-white"
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                  {p.coverImage
                    ? <img src={`/api/storage-image?path=${encodeURIComponent(p.coverImage)}`} alt={p.title} className="w-full h-full object-cover" />
                    : 'No cover'}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 line-clamp-2">{p.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{p.contentKind}</p>
                  <p className="text-lg font-bold text-gray-900 mt-2">Rp {p.price.toLocaleString('id-ID')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

### Step 2: Write the block-form (admin editor)

Create `components/admin/blocks/forms/ProductGridBlockForm.tsx` mirroring the pattern of existing block forms in `components/admin/blocks/forms/`. The form must expose: `title`, `subtitle`, `limit` (number), `columns` (select 2/3/4). Use the standard block-form chrome — check `components/admin/blocks/forms/FeatureCardsBlockForm.tsx` (or similar) as the reference. Save to disk only after reading at least one existing form.

### Step 3: Register the block

In `components/blocks/BlockRenderer.tsx`, add the case for `'digital_goods_product_grid'` that dynamically imports and renders `ProductGridBlock`. In `components/admin/blocks/BlockFormRenderer.tsx`, add the analogous case for the form. In `data/mockData.ts`, ensure `BlockType` includes the new type string (the type allows `| string` so this is documentation, not a hard requirement — but add it for explicitness).

### Step 4: Write the auto-page helper

Create `lib/modules/digital_goods/auto-page.ts`:

```ts
import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const STORE_PAGE_ID = 'digital-goods-store';
const STORE_PAGE_SLUG = 'store';

/**
 * Idempotently create a Custom Page named "Store" with a ProductGrid block pre-placed.
 * Called when the digital_goods module is first enabled on a tenant.
 */
export async function ensureStorePageExists(siteId: string): Promise<void> {
  const pageRef = adminDb.doc(`sites/${siteId}/pages/${STORE_PAGE_ID}`);
  const snap = await pageRef.get();
  if (snap.exists) return;

  await pageRef.set({
    id: STORE_PAGE_ID,
    title: 'Store',
    slug: STORE_PAGE_SLUG,
    visible: true,
    blocks: [
      {
        id: 'product-grid-default',
        type: 'digital_goods_product_grid',
        data: {
          title: 'Store',
          subtitle: 'Browse and buy digital products.',
          limit: 12,
          columns: 3,
        },
      },
    ],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'system:digital_goods',
  });
}
```

**Note on the pages collection path:** Verify by reading `app/admin/(dashboard)/pages/page.tsx` — the actual path may be `sites/{siteId}/pages` or `sites/{siteId}/customPages` or similar. If the existing custom-pages module uses a different shape, adapt the field names (e.g. `name` vs `title`, `slug` field omitted if Firestore doc ID is the slug). Do NOT invent fields — match the existing schema.

### Step 5: Wire the auto-page into module activation

This requires knowing where the platform handles "module enabled for tenant" transitions. Inspect:

```bash
grep -rn "modules\.\${moduleId}\|setEnabled.*module\|enableModule" lib backyard --include="*.ts" --include="*.tsx" | head -10
```

If there's an obvious hook (e.g. in Backyard's module-toggle code or a Cloud Function), add a one-line call to `ensureStorePageExists(siteId)` when `digital_goods` flips from disabled to enabled. If no such hook exists, the safer fallback is: call `ensureStorePageExists(siteId)` once on every successful order creation (Task 8) — but only as a fire-and-forget side effect, never blocking the order. Document the choice in the commit message.

### Step 6: TypeScript check

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|ProductGridBlock|auto-page)" | head
```

Expected: empty.

### Step 7: Commit

```bash
git add clicker-platform-v2/components/blocks/public/ProductGridBlock.tsx \
        clicker-platform-v2/components/admin/blocks/forms/ProductGridBlockForm.tsx \
        clicker-platform-v2/components/blocks/BlockRenderer.tsx \
        clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx \
        clicker-platform-v2/data/mockData.ts \
        clicker-platform-v2/lib/modules/digital_goods/auto-page.ts
git commit -m "feat(digital_goods): ProductGrid block + auto-create Store custom page"
```

---

### Task 6: Public product detail page + Buy Now logic

**Files:**
- Create: `app/store/[slug]/page.tsx`
- Create: `app/store/[slug]/StoreProductClient.tsx`

- [ ] **Step 1: Write the page (server component)**

Create `app/store/[slug]/page.tsx`:

```tsx
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { COLLECTION_PRODUCTS } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct } from '@/lib/modules/digital_goods/types';
import { StoreProductClient } from './StoreProductClient';

export const revalidate = 0;

async function fetchProductBySlug(siteId: string, slug: string): Promise<DigitalProduct | null> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_PRODUCTS}`)
    .where('slug', '==', slug)
    .where('status', '==', 'published')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as DigitalProduct;
}

export default async function StoreItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';

  const product = await fetchProductBySlug(siteId, slug);
  if (!product) notFound();

  // Serialize Timestamps to ISO strings for client component
  const serialized = {
    ...product,
    createdAt: product.createdAt?.toDate().toISOString(),
    updatedAt: product.updatedAt?.toDate().toISOString(),
    publishedAt: product.publishedAt?.toDate().toISOString() ?? null,
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden">
        {product.coverImage && (
          <div className="aspect-video bg-gray-100">
            <img src={`/api/storage-image?path=${encodeURIComponent(product.coverImage)}`} alt={product.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500">{product.contentKind}</p>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">{product.title}</h1>
          <p className="text-2xl font-bold text-gray-900 mt-3">Rp {product.price.toLocaleString('id-ID')}</p>
          {product.description && (
            <p className="text-gray-700 mt-4 whitespace-pre-wrap">{product.description}</p>
          )}
          <StoreProductClient siteId={siteId} product={serialized as any} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the client component (Buy Now + already-purchased guard)**

Create `app/store/[slug]/StoreProductClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { hasLibraryEntryForProduct } from '@/lib/modules/digital_goods/library';
import { PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct, LibraryEntry } from '@/lib/modules/digital_goods/types';

interface Props {
  siteId: string;
  product: DigitalProduct;
}

export function StoreProductClient({ siteId, product }: Props) {
  const router = useRouter();
  const [user, loadingAuth] = useAuthState(auth);
  const [owned, setOwned] = useState<LibraryEntry | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) { setChecking(false); return; }
    let cancelled = false;
    hasLibraryEntryForProduct(siteId, user.uid, product.id)
      .then(entry => { if (!cancelled) setOwned(entry); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [siteId, user, loadingAuth, product.id]);

  if (checking) {
    return <div className="mt-6 h-12 bg-gray-100 rounded-lg animate-pulse" />;
  }

  if (owned) {
    return (
      <button
        onClick={() => router.push(`${PUBLIC_ROUTES.library}/${owned.id}`)}
        className="mt-6 w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition"
      >
        Open in Library <ArrowRight size={18} />
      </button>
    );
  }

  function handleBuy() {
    const nextUrl = `${PUBLIC_ROUTES.store}/${product.slug}/checkout`;
    if (!user) {
      router.push(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(nextUrl)}`);
    } else {
      router.push(nextUrl);
    }
  }

  return (
    <button
      onClick={handleBuy}
      className="mt-6 w-full bg-studio-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-studio-blue/90 transition active:scale-95"
    >
      Buy Now
    </button>
  );
}
```

> **Dependency note:** `react-firebase-hooks` should already be installed at the platform level. Verify with `grep react-firebase-hooks package.json`. If absent, install via `pnpm add react-firebase-hooks`.

- [ ] **Step 3: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|app/store)" | head
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/app/store/\[slug\]/
git commit -m "feat(digital_goods): product detail page with Buy Now + already-purchased guard"
```

---

### Task 7: Smoke-test the store block + product detail

**Files:** (none — manual verification)

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify auto-created Store page**

In the tenant admin, navigate to `/admin/pages`. Confirm a page titled "Store" (slug: `store`) exists with one `digital_goods_product_grid` block pre-placed. If absent, manually trigger `ensureStorePageExists(siteId)` (or re-enable the digital_goods module) — either should idempotently create it.

- [ ] **Step 3: Confirm block edit UX**

Open the Store page in Canvas Studio. Click the ProductGrid block. The right-side block-form panel should show title / subtitle / limit / columns inputs. Edit title to "Toko Saya" and save. Verify the change persists.

- [ ] **Step 4: Browse the live page**

Navigate to `tenant.localhost:3000/store` (resolved by the platform's custom-page routing). Confirm:

- Empty state shows if no published products exist.
- Published products from Plan 1 appear in the grid using the configured columns / limit.
- Click a product → `/store/[slug]` detail page renders.
- Click "Buy Now" while logged out → redirects to `/store/login?next=/store/[slug]/checkout` (digital_goods's own login).

- [ ] **Step 5: Verify tenant can move the block**

In Canvas Studio, drag the ProductGrid block to a different page (e.g., the homepage). Confirm it renders correctly there too. This is the customization win — the whole reason we chose block over standalone route.

- [ ] **Step 6: Mark task complete**

If all the above works, mark task complete. No commit.

---

## Phase 3 — Checkout + order admin (Tasks 8–11)

### Task 8: Checkout server action + page

**Files:**
- Create: `app/api/digital-goods/checkout/route.ts`
- Create: `app/store/[slug]/checkout/page.tsx`
- Create: `app/store/[slug]/checkout/CheckoutClient.tsx`

- [ ] **Step 1: Write the checkout API endpoint**

Create `app/api/digital-goods/checkout/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  upsertBuyerAdmin, createOrderAdmin,
} from '@/lib/modules/digital_goods/server-api';
import {
  COLLECTION_PRODUCTS, DOC_SETTINGS,
} from '@/lib/modules/digital_goods/constants';
import { sendNewOrderTenantEmail } from '@/lib/modules/digital_goods/emails';
import type {
  DigitalProduct, DigitalGoodsSettings, ProductSnapshot, PaymentInstructions,
} from '@/lib/modules/digital_goods/types';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { productId, buyerNote, fullName } = body as { productId?: string; buyerNote?: string; fullName?: string };
  if (!productId) return NextResponse.json({ error: 'missing_product' }, { status: 400 });

  // Load product + settings
  const [productSnap, settingsSnap] = await Promise.all([
    adminDb.doc(`sites/${siteId}/${COLLECTION_PRODUCTS}/${productId}`).get(),
    adminDb.doc(`sites/${siteId}/${DOC_SETTINGS}`).get(),
  ]);
  if (!productSnap.exists) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  if (!settingsSnap.exists) return NextResponse.json({ error: 'settings_not_configured' }, { status: 400 });

  const product = productSnap.data() as DigitalProduct;
  const settings = settingsSnap.data() as DigitalGoodsSettings;

  if (product.status !== 'published') {
    return NextResponse.json({ error: 'product_not_published' }, { status: 400 });
  }

  // Auto-provision buyer
  await upsertBuyerAdmin(siteId, decoded.uid, {
    email: decoded.email ?? '',
    fullName: fullName?.trim() || undefined,
  });

  const productSnapshot: ProductSnapshot = {
    title: product.title,
    coverImage: product.coverImage,
    price: product.price,
    currency: 'IDR',
    contentKind: product.contentKind,
    type: product.type,
  };

  const paymentInstructions: PaymentInstructions = {
    bankName: settings.bankName,
    accountNumber: settings.accountNumber,
    accountName: settings.accountName,
    qrisImageUrl: settings.qrisImageUrl,
  };

  const orderId = await createOrderAdmin(siteId, {
    buyerId: decoded.uid,
    productId,
    productSnapshot,
    amount: product.price,
    paymentInstructions,
    buyerNote: buyerNote?.trim() || undefined,
  });

  // Fire-and-forget tenant email (non-blocking)
  sendNewOrderTenantEmail(siteId, {
    orderId,
    buyerEmail: decoded.email ?? '',
    productTitle: product.title,
    amount: product.price,
  }).catch(err => {
    logger.error('digital_goods.email.tenant.failed', { siteId, orderId, error: err });
  });

  return NextResponse.json({ orderId });
}
```

- [ ] **Step 2: Write the checkout page (server component)**

Create `app/store/[slug]/checkout/page.tsx`:

```tsx
import { headers, cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_PRODUCTS, DOC_SETTINGS, PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct, DigitalGoodsSettings } from '@/lib/modules/digital_goods/types';
import { CheckoutClient } from './CheckoutClient';

export const revalidate = 0;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) {
    redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.store}/${slug}/checkout`)}`);
  }

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.store}/${slug}/checkout`)}`);
  }

  const productSnap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_PRODUCTS}`)
    .where('slug', '==', slug)
    .where('status', '==', 'published')
    .limit(1)
    .get();
  if (productSnap.empty) notFound();
  const product = { id: productSnap.docs[0].id, ...productSnap.docs[0].data() } as DigitalProduct;

  const settingsSnap = await adminDb.doc(`sites/${siteId}/${DOC_SETTINGS}`).get();
  const settings = settingsSnap.exists ? settingsSnap.data() as DigitalGoodsSettings : null;

  if (!settings || !settings.bankName) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900">Checkout unavailable</h1>
          <p className="text-gray-600 mt-2">The store owner has not configured payment details yet.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h1>
        <CheckoutClient
          siteId={siteId}
          productId={product.id}
          productTitle={product.title}
          amount={product.price}
          buyerEmail={decoded.email ?? ''}
          bankName={settings.bankName}
          accountNumber={settings.accountNumber}
          accountName={settings.accountName}
          qrisImageUrl={settings.qrisImageUrl}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write the checkout client**

Create `app/store/[slug]/checkout/CheckoutClient.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';

interface Props {
  siteId: string;
  productId: string;
  productTitle: string;
  amount: number;
  buyerEmail: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisImageUrl?: string;
}

export function CheckoutClient(props: Props) {
  const router = useRouter();
  const [buyerNote, setBuyerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/digital-goods/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: props.productId, buyerNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'submit_failed');
      router.push(`${PUBLIC_ROUTES.orderStatus}/${data.orderId}`);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit order.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Order summary */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Order summary</h2>
        <div className="flex justify-between text-sm text-gray-700">
          <span>{props.productTitle}</span>
          <span className="font-medium">Rp {props.amount.toLocaleString('id-ID')}</span>
        </div>
        <div className="border-t border-gray-100 mt-4 pt-3 flex justify-between text-base">
          <span className="font-medium">Total</span>
          <span className="font-bold">Rp {props.amount.toLocaleString('id-ID')}</span>
        </div>
        <p className="text-xs text-gray-500 mt-3">Logged in as <strong>{props.buyerEmail}</strong></p>
      </section>

      {/* Payment instructions */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Cara bayar</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500">Bank</p>
            <p className="font-bold text-lg">{props.bankName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Nomor rekening</p>
            <p className="font-mono text-lg font-bold">{props.accountNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Atas nama</p>
            <p className="font-medium">{props.accountName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Jumlah</p>
            <p className="font-mono text-lg font-bold">Rp {props.amount.toLocaleString('id-ID')}</p>
          </div>
        </div>
        {props.qrisImageUrl && (
          <p className="text-xs text-gray-500 mt-3">Atau scan QRIS (gambar tersedia di halaman setelah submit).</p>
        )}
      </section>

      {/* Confirm */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Konfirmasi pembayaran</h2>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Catatan transfer <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <input
          type="text"
          value={buyerNote}
          onChange={e => setBuyerNote(e.target.value)}
          placeholder="Paste nomor referensi atau catatan lain"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-green-600 text-white px-6 py-4 rounded-lg text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting && <Loader2 className="animate-spin" size={18} />}
          Saya sudah transfer
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          Setelah Anda klik, kami akan minta penjual mengkonfirmasi pembayaran.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|checkout)" | head
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/app/api/digital-goods/checkout/ clicker-platform-v2/app/store/\[slug\]/checkout/
git commit -m "feat(digital_goods): checkout endpoint + page (creates awaiting_confirmation order)"
```

---

### Task 9: Email helpers + template alias registration

**Files:**
- Create: `lib/modules/digital_goods/emails.ts`
- Modify: `lib/email/config.ts`

- [ ] **Step 1: Inspect existing email config**

```bash
grep -A 20 "templates" lib/email/config.ts | head -30
```

You'll see a map like `{ regConfirmation: '...', regAdminNotif: '...' }`. We'll add two new keys.

- [ ] **Step 2: Add template aliases to config**

In `lib/email/config.ts`, find the `templates` map and add (matching existing style):

```ts
digitalGoodsNewOrderTenant: 'digital-goods-new-order-tenant',
digitalGoodsOrderPaidBuyer: 'digital-goods-order-paid-buyer',
```

(The right-hand string is the Resend template-alias slug that the platform admin will configure in Resend. Plan 2 only registers the key.)

- [ ] **Step 3: Write the email helpers**

Create `lib/modules/digital_goods/emails.ts`:

```ts
import 'server-only';
import { sendEmail, getTemplateAliases } from '@/lib/email';
import { adminDb } from '@/lib/firebase-admin';
import { EMAIL_ALIAS_KEYS } from './constants';

// Lookup tenant owner email — used to send "new order" notification.
async function getTenantOwnerEmail(siteId: string): Promise<string | null> {
  const siteSnap = await adminDb.doc(`sites/${siteId}`).get();
  if (!siteSnap.exists) return null;
  return (siteSnap.data()?.ownerEmail as string | undefined) ?? null;
}

export async function sendNewOrderTenantEmail(
  siteId: string,
  args: { orderId: string; buyerEmail: string; productTitle: string; amount: number },
): Promise<void> {
  const aliases = await getTemplateAliases();
  const tenantEmail = await getTenantOwnerEmail(siteId);
  if (!tenantEmail) return;
  await sendEmail({
    siteId,
    to: tenantEmail,
    templateAlias: aliases[EMAIL_ALIAS_KEYS.newOrderTenant] ?? EMAIL_ALIAS_KEYS.newOrderTenant,
    variables: {
      orderId: args.orderId,
      buyerEmail: args.buyerEmail,
      productTitle: args.productTitle,
      amount: args.amount.toLocaleString('id-ID'),
    },
    tags: [{ name: 'module', value: 'digital_goods' }, { name: 'event', value: 'new_order' }],
  });
}

export async function sendOrderPaidBuyerEmail(
  siteId: string,
  args: { buyerEmail: string; productTitle: string; libraryUrl: string },
): Promise<void> {
  const aliases = await getTemplateAliases();
  await sendEmail({
    siteId,
    to: args.buyerEmail,
    templateAlias: aliases[EMAIL_ALIAS_KEYS.orderPaidBuyer] ?? EMAIL_ALIAS_KEYS.orderPaidBuyer,
    variables: {
      productTitle: args.productTitle,
      libraryUrl: args.libraryUrl,
    },
    tags: [{ name: 'module', value: 'digital_goods' }, { name: 'event', value: 'order_paid' }],
  });
}
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|email)" | head
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/digital_goods/emails.ts clicker-platform-v2/lib/email/config.ts
git commit -m "feat(digital_goods): email helpers + register template aliases"
```

---

### Task 10: Admin Orders list with slide-over detail

**Files:**
- Create: `lib/modules/digital_goods/admin/OrdersListPage.tsx`
- Create: `lib/modules/digital_goods/admin/components/OrderDetailForm.tsx`
- Create: `app/api/digital-goods/orders/confirm/route.ts`
- Create: `app/api/digital-goods/orders/cancel/route.ts`

> **Rule 9 reminder:** Before writing OrdersListPage, open `lib/modules/promo/components/PromoListPage.tsx` AND `lib/modules/digital_goods/admin/ProductsListPage.tsx` (which already follows the slide-over pattern). Mirror them. Open `lib/modules/digital_goods/admin/components/ProductForm.tsx` as the slide-over chrome reference.

- [ ] **Step 1: Write the confirm endpoint**

Create `app/api/digital-goods/orders/confirm/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { confirmOrderPaidAdmin } from '@/lib/modules/digital_goods/server-api';
import { sendOrderPaidBuyerEmail } from '@/lib/modules/digital_goods/emails';
import { adminDb } from '@/lib/firebase-admin';
import { PUBLIC_ROUTES, COLLECTION_BUYERS } from '@/lib/modules/digital_goods/constants';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }

  const body = await req.json().catch(() => ({}));
  const { orderId, paymentRef } = body as { orderId?: string; paymentRef?: string };
  if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });

  try {
    const { order, libraryEntryId } = await confirmOrderPaidAdmin(siteId, {
      orderId,
      confirmedBy: decoded.uid,
      paymentRef: paymentRef?.trim() || undefined,
    });

    // Look up buyer email and fire confirmation email
    const buyerSnap = await adminDb.doc(`sites/${siteId}/${COLLECTION_BUYERS}/${order.buyerId}`).get();
    const buyerEmail = buyerSnap.exists ? (buyerSnap.data()?.email as string | undefined) : undefined;
    if (buyerEmail) {
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
      const libraryUrl = `${proto}://${host}${PUBLIC_ROUTES.library}/${libraryEntryId}`;
      sendOrderPaidBuyerEmail(siteId, {
        buyerEmail,
        productTitle: order.productSnapshot.title,
        libraryUrl,
      }).catch(err => logger.error('digital_goods.email.buyer.failed', { siteId, orderId, error: err }));
    }

    return NextResponse.json({ ok: true, libraryEntryId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'server_error' }, { status: 400 });
  }
}
```

- [ ] **Step 2: Write the cancel endpoint**

Create `app/api/digital-goods/orders/cancel/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { cancelOrderAdmin } from '@/lib/modules/digital_goods/server-api';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try { await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }

  const body = await req.json().catch(() => ({}));
  const { orderId } = body as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });

  try {
    await cancelOrderAdmin(siteId, orderId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'server_error' }, { status: 400 });
  }
}
```

- [ ] **Step 3: Write `OrderDetailForm.tsx` (slide-over)**

Create `lib/modules/digital_goods/admin/components/OrderDetailForm.tsx` mirroring `ProductForm.tsx`'s slide-over structure (fixed overlay, right panel, sticky header + footer). Body shows: order ID, buyer email, product title, amount, payment method, bank info, buyer note, created timestamp. Footer has "Tandai Lunas" (calls `/api/digital-goods/orders/confirm`) and "Cancel" (calls `/api/digital-goods/orders/cancel`).

```tsx
'use client';

import { useState } from 'react';
import { X, Receipt, Loader2 } from 'lucide-react';
import type { DigitalOrder } from '../../types';

interface Props {
  order: DigitalOrder;
  onClose: () => void;
  onUpdated: () => void;
}

export function OrderDetailForm({ order, onClose, onUpdated }: Props) {
  const [paymentRef, setPaymentRef] = useState(order.paymentRef ?? '');
  const [acting, setActing] = useState<null | 'confirm' | 'cancel'>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = order.status === 'awaiting_confirmation';

  async function callEndpoint(path: string, body: object) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'request_failed');
  }

  async function handleConfirm() {
    setActing('confirm'); setError(null);
    try {
      await callEndpoint('/api/digital-goods/orders/confirm', { orderId: order.id, paymentRef });
      onUpdated(); onClose();
    } catch (e: any) { setError(e?.message ?? 'Failed to confirm.'); }
    finally { setActing(null); }
  }

  async function handleCancel() {
    setActing('cancel'); setError(null);
    try {
      await callEndpoint('/api/digital-goods/orders/cancel', { orderId: order.id });
      onUpdated(); onClose();
    } catch (e: any) { setError(e?.message ?? 'Failed to cancel.'); }
    finally { setActing(null); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-end backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-gray-500 dark:text-neutral-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Order #{order.id.slice(0, 8)}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-neutral-100" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Status</p>
            <p className="text-sm font-semibold mt-0.5">
              <span className={`px-2 py-1 rounded text-xs ${
                order.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                order.status === 'cancelled' ? 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400' :
                'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              }`}>{order.status}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Product</p>
            <p className="text-sm font-medium text-gray-900 dark:text-neutral-100 mt-0.5">{order.productSnapshot.title}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Buyer ID</p>
            <p className="text-sm font-mono text-gray-700 dark:text-neutral-300 mt-0.5">{order.buyerId}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Amount</p>
            <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-0.5">Rp {order.amount.toLocaleString('id-ID')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Bank</p>
            <p className="text-sm text-gray-700 dark:text-neutral-300 mt-0.5">{order.paymentInstructions.bankName} · {order.paymentInstructions.accountNumber}</p>
          </div>
          {order.buyerNote && (
            <div>
              <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Buyer note</p>
              <p className="text-sm text-gray-700 dark:text-neutral-300 mt-0.5 italic">"{order.buyerNote}"</p>
            </div>
          )}
          {isPending && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1">
                Bank reference <span className="font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="e.g. BCA TRF20260524-001"
                className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        {isPending && (
          <div className="sticky bottom-0 px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={acting !== null}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {acting === 'confirm' && <Loader2 className="animate-spin w-4 h-4" />}
              Tandai Lunas
            </button>
            <button
              onClick={handleCancel}
              disabled={acting !== null}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-600 dark:border-red-800/40 dark:text-red-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `OrdersListPage.tsx`**

Create `lib/modules/digital_goods/admin/OrdersListPage.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Receipt, Pencil } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { listOrders } from '../orders';
import type { DigitalOrder, OrderStatus } from '../types';
import { OrderDetailForm } from './components/OrderDetailForm';

const FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_confirmation', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function OrdersListPage() {
  const { siteId } = useSite();
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [editingOrder, setEditingOrder] = useState<DigitalOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      const items = await listOrders(siteId);
      setOrders(items);
    } catch (e) {
      logger.error('digital_goods.orders.load.failed', { siteId, error: e });
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === 'awaiting_confirmation').length;

  if (!siteId) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Orders</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Confirm bank transfers and manage buyer purchases.</p>
      </header>

      {pendingCount > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg text-sm flex items-center justify-between">
          <span className="text-amber-900 dark:text-amber-200">
            <strong>{pendingCount}</strong> order{pendingCount === 1 ? '' : 's'} awaiting confirmation
          </span>
          <button onClick={() => setFilter('awaiting_confirmation')} className="text-amber-900 dark:text-amber-200 underline text-xs">
            Filter pending →
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === f.key
                ? 'bg-white dark:bg-neutral-700 shadow text-gray-900 dark:text-neutral-100'
                : 'text-gray-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-700/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded text-red-700 dark:text-red-400 text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-neutral-800 rounded animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" size={32} />
            <p className="text-sm text-gray-500 dark:text-neutral-400">No orders {filter === 'all' ? 'yet' : `with status ${filter}`}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(o => (
                <tr key={o.id} className="border-t border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-neutral-400">#{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">{o.productSnapshot.title}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-neutral-100">Rp {o.amount.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      o.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                      o.status === 'cancelled' ? 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditingOrder(o)}
                      className="p-2 text-gray-600 dark:text-neutral-400 hover:text-studio-blue dark:hover:text-studio-blue"
                      aria-label="View order"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingOrder && (
        <OrderDetailForm
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Register the page in components.tsx and definitions.ts**

In `lib/modules/components.tsx`, add to the Digital Goods section:

```tsx
const DG_OrdersListPage = dynamic(() => import('@/lib/modules/digital_goods/admin/OrdersListPage'));
```

And in `MODULE_COMPONENTS`:

```tsx
'digital_goods:OrdersList': DG_OrdersListPage,
```

In `lib/modules/definitions.ts`, in the `'digital_goods'` entry, insert this admin route between `Products` and `Settings`:

```ts
{ label: 'Orders', path: '/admin/digital-goods/orders', icon: 'receipt', componentKey: 'digital_goods:OrdersList' },
```

- [ ] **Step 6: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|orders)" | head
```

Expected: empty.

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/lib/modules/digital_goods/admin/OrdersListPage.tsx clicker-platform-v2/lib/modules/digital_goods/admin/components/OrderDetailForm.tsx clicker-platform-v2/lib/modules/components.tsx clicker-platform-v2/lib/modules/definitions.ts clicker-platform-v2/app/api/digital-goods/orders/
git commit -m "feat(digital_goods): admin orders list + slide-over confirm/cancel"
```

---

### Task 11: Update Firestore + Storage rules for Plan 2

**Files:**
- Modify: `firestore.rules`
- Modify: `storage.rules`

- [ ] **Step 1: Add buyer, order, and library rules**

In `firestore.rules`, within the `match /sites/{siteId}/...` block where Plan 1's digital_goods rules live, REPLACE the Plan 2 stubs (the commented-out `// match /modules/digital_goods/orders/...` lines) with:

```javascript
match /modules/digital_goods/buyers/{uid} {
  // Buyer can read + write their own doc; admin can read for support
  allow read: if request.auth != null && (request.auth.uid == uid || (isValidUser(siteId) && isOwner(siteId)));
  allow write: if request.auth != null && request.auth.uid == uid;
}

match /modules/digital_goods/orders/{orderId} {
  // Buyer reads own orders; admin reads/writes all
  allow read: if request.auth != null && (
    resource.data.buyerId == request.auth.uid
    || (isValidUser(siteId) && hasRole(siteId, ['owner', 'staff']))
  );
  // Client writes blocked entirely. Server-only via Admin SDK.
  allow write: if false;
}

match /modules/digital_goods/library/{entryId} {
  // Buyer reads own entries; admin reads all
  allow read: if request.auth != null && (
    resource.data.buyerId == request.auth.uid
    || (isValidUser(siteId) && hasRole(siteId, ['owner', 'staff']))
  );
  // Server-only writes
  allow write: if false;
}
```

- [ ] **Step 2: Tighten storage rules for PDF files**

In `storage.rules`, ABOVE the existing catch-all `match /sites/{siteId}/{allPaths=**}` rule, add a more specific rule that BLOCKS public read of digital_goods product files (signed URLs handle access):

```javascript
// Digital Goods product files: block direct reads; admin can write for upload, signed URLs handle delivery
match /sites/{siteId}/modules/digital_goods/products/files/{allPaths=**} {
  allow read: if false;
  allow write: if request.auth != null;
}
```

Order matters in Firebase Storage rules — the more specific rule MUST appear before the wildcard. Verify by reading the file's current structure first.

- [ ] **Step 3: Deploy rules to clicker-universe-stagging**

```bash
firebase deploy --only firestore:rules,storage --project clicker-universe-stagging
```

Expected: `✔ Deploy complete!`.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/firestore.rules clicker-platform-v2/storage.rules
git commit -m "feat(digital_goods): Plan 2 firestore + storage rules (buyers/orders/library + signed-url-only PDFs)"
```

---

## Phase 4 — Library + buyer pages (Tasks 12–15)

### Task 12: Buyer library page + entry detail

**Files:**
- Create: `app/library/page.tsx`
- Create: `app/library/[entryId]/page.tsx`
- Create: `app/library/[entryId]/LibraryEntryClient.tsx`

- [ ] **Step 1: Write `/library` (server component)**

Create `app/library/page.tsx`:

```tsx
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY, PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { LibraryEntry } from '@/lib/modules/digital_goods/types';

export const revalidate = 0;

async function fetchLibrary(siteId: string, uid: string): Promise<LibraryEntry[]> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('buyerId', '==', uid)
    .orderBy('purchasedAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryEntry));
}

export default async function LibraryPage() {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (!sessionCookie) {
    redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(PUBLIC_ROUTES.library)}`);
  }

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(PUBLIC_ROUTES.library)}`); }

  const entries = await fetchLibrary(siteId, decoded.uid);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Library</h1>
          <p className="text-sm text-gray-500 mt-1">Everything you've purchased.</p>
        </header>
        {entries.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-600 font-medium mb-2">Your library is empty</p>
            <Link href={PUBLIC_ROUTES.store} className="inline-block bg-studio-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-studio-blue/90">
              Browse Store
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map(e => (
              <Link
                key={e.id}
                href={`${PUBLIC_ROUTES.library}/${e.id}`}
                className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition"
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                  {e.productSnapshot.coverImage
                    ? <img src={`/api/storage-image?path=${encodeURIComponent(e.productSnapshot.coverImage)}`} alt={e.productSnapshot.title} className="w-full h-full object-cover" />
                    : 'Cover'}
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500">{e.productSnapshot.contentKind}</p>
                  <h3 className="font-semibold text-gray-900 mt-1 line-clamp-2">{e.productSnapshot.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write `/library/[entryId]` (server) + client**

Create `app/library/[entryId]/page.tsx`:

```tsx
import { headers, cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY, COLLECTION_PRODUCTS, PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { LibraryEntry, DigitalProduct, PdfFile, YouTubeFile } from '@/lib/modules/digital_goods/types';
import { LibraryEntryClient } from './LibraryEntryClient';

export const revalidate = 0;

export default async function LibraryEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.library}/${entryId}`)}`);

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.library}/${entryId}`)}`); }

  const entrySnap = await adminDb.doc(`sites/${siteId}/${COLLECTION_LIBRARY}/${entryId}`).get();
  if (!entrySnap.exists) notFound();
  const entry = { id: entrySnap.id, ...entrySnap.data() } as LibraryEntry;
  if (entry.buyerId !== decoded.uid) notFound();

  // Load the underlying product to access files[]
  const productSnap = await adminDb.doc(`sites/${siteId}/${COLLECTION_PRODUCTS}/${entry.productId}`).get();
  if (!productSnap.exists) notFound();
  const product = productSnap.data() as DigitalProduct;

  const pdf = product.files.find(f => f.kind === 'pdf') as PdfFile | undefined;
  const yt = product.files.find(f => f.kind === 'youtube') as YouTubeFile | undefined;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden">
        {entry.productSnapshot.coverImage && (
          <div className="aspect-video bg-gray-100">
            <img src={`/api/storage-image?path=${encodeURIComponent(entry.productSnapshot.coverImage)}`} alt={entry.productSnapshot.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500">{entry.productSnapshot.contentKind}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{entry.productSnapshot.title}</h1>

          <div className="mt-6">
            <LibraryEntryClient
              productId={entry.productId}
              pdfStoragePath={pdf?.storagePath ?? null}
              pdfFilename={pdf?.name ?? null}
              youtubeUrl={yt?.url ?? null}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
```

Create `app/library/[entryId]/LibraryEntryClient.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface Props {
  productId: string;
  pdfStoragePath: string | null;
  pdfFilename: string | null;
  youtubeUrl: string | null;
}

export function LibraryEntryClient({ productId, pdfStoragePath, pdfFilename, youtubeUrl }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!pdfStoragePath) return;
    setDownloading(true); setError(null);
    try {
      const res = await fetch(`/api/digital-goods/files/_/`.replace('_', encodeURIComponent(productId)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, storagePath: pdfStoragePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'request_failed');
      window.open(data.url, '_blank');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to get download link.');
    } finally {
      setDownloading(false);
    }
  }

  if (youtubeUrl) {
    const embedUrl = toYouTubeEmbed(youtubeUrl);
    return (
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <iframe src={embedUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
      </div>
    );
  }

  if (pdfStoragePath) {
    return (
      <div className="space-y-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="bg-studio-blue text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-studio-blue/90 disabled:opacity-50"
        >
          {downloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          Download PDF {pdfFilename && <span className="font-normal opacity-80">({pdfFilename})</span>}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return <p className="text-gray-500 text-sm">No content available.</p>;
}

function toYouTubeEmbed(url: string): string {
  // Convert youtube.com/watch?v=ID or youtu.be/ID to youtube.com/embed/ID
  const u = new URL(url);
  let id = '';
  if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
  else id = u.searchParams.get('v') ?? '';
  return `https://www.youtube.com/embed/${id}`;
}
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|app/library)" | head
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/app/library/
git commit -m "feat(digital_goods): buyer library + entry detail with signed-URL download"
```

---

### Task 13: Order status page (live updates)

**Files:**
- Create: `app/library/orders/[orderId]/page.tsx`
- Create: `app/library/orders/[orderId]/OrderStatusClient.tsx`

- [ ] **Step 1: Write the server page**

Create `app/library/orders/[orderId]/page.tsx`:

```tsx
import { headers, cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_ORDERS, PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { DigitalOrder } from '@/lib/modules/digital_goods/types';
import { OrderStatusClient } from './OrderStatusClient';

export const revalidate = 0;

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.orderStatus}/${orderId}`)}`);

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { redirect(`${PUBLIC_ROUTES.login}?next=${encodeURIComponent(`${PUBLIC_ROUTES.orderStatus}/${orderId}`)}`); }

  const snap = await adminDb.doc(`sites/${siteId}/${COLLECTION_ORDERS}/${orderId}`).get();
  if (!snap.exists) notFound();
  const order = { id: snap.id, ...snap.data() } as DigitalOrder;
  if (order.buyerId !== decoded.uid) notFound();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Order #{order.id.slice(0, 8)}</h1>
        <OrderStatusClient siteId={siteId} orderId={order.id} initialOrder={order} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the live-update client**

Create `app/library/orders/[orderId]/OrderStatusClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { subscribeOrder } from '@/lib/modules/digital_goods/orders';
import { PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';
import type { DigitalOrder } from '@/lib/modules/digital_goods/types';

interface Props {
  siteId: string;
  orderId: string;
  initialOrder: DigitalOrder;
}

export function OrderStatusClient({ siteId, orderId, initialOrder }: Props) {
  const [order, setOrder] = useState<DigitalOrder>(initialOrder);
  const [libraryEntryId, setLibraryEntryId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeOrder(siteId, orderId, o => { if (o) setOrder(o); });
    return () => unsub();
  }, [siteId, orderId]);

  // When the order flips to paid, the server creates a library entry. We don't know its ID until lookup.
  useEffect(() => {
    if (order.status !== 'paid') return;
    // Best-effort: query the library for this orderId
    fetch(`/api/digital-goods/lookup-library?orderId=${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.libraryEntryId && setLibraryEntryId(d.libraryEntryId))
      .catch(() => {});
  }, [order.status, orderId]);

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">Status</p>
        <p className="text-lg font-bold mt-1">
          <span className={`px-3 py-1 rounded ${
            order.status === 'paid' ? 'bg-green-100 text-green-700' :
            order.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
            'bg-amber-100 text-amber-700'
          }`}>{order.status}</span>
        </p>
        {order.status === 'awaiting_confirmation' && (
          <p className="text-sm text-gray-600 mt-3">Kami akan kirim email saat pesanan dikonfirmasi.</p>
        )}
        {order.status === 'paid' && libraryEntryId && (
          <Link
            href={`${PUBLIC_ROUTES.library}/${libraryEntryId}`}
            className="inline-block mt-3 bg-studio-blue text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-studio-blue/90"
          >
            Lihat di Library →
          </Link>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">Product</p>
        <p className="text-sm font-medium text-gray-900 mt-1">{order.productSnapshot.title}</p>
        <p className="text-lg font-bold mt-2">Rp {order.amount.toLocaleString('id-ID')}</p>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">Bank</p>
        <p className="text-sm text-gray-700 mt-1">{order.paymentInstructions.bankName} · {order.paymentInstructions.accountNumber}</p>
        <p className="text-sm text-gray-700">a/n {order.paymentInstructions.accountName}</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Write the library-lookup helper endpoint**

Create `app/api/digital-goods/lookup-library/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY } from '@/lib/modules/digital_goods/constants';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }

  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });

  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('orderId', '==', orderId)
    .where('buyerId', '==', decoded.uid)
    .limit(1)
    .get();
  if (snap.empty) return NextResponse.json({ libraryEntryId: null });
  return NextResponse.json({ libraryEntryId: snap.docs[0].id });
}
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "(digital_goods|library/orders|lookup-library)" | head
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/app/library/orders/ clicker-platform-v2/app/api/digital-goods/lookup-library/
git commit -m "feat(digital_goods): live order status page + library lookup endpoint"
```

---

### Task 14: Update seed-modules.ts + redeploy

**Files:**
- Modify: `scripts/seed-modules.ts`

- [ ] **Step 1: Update the digital_goods entry's adminRoutes**

In `scripts/seed-modules.ts`, find the `digital_goods` entry and update `adminRoutes` to include Orders:

```ts
adminRoutes: [
    { label: 'Products', path: '/admin/digital-goods',          icon: 'shopping-bag', componentKey: 'digital_goods:ProductsList' },
    { label: 'Orders',   path: '/admin/digital-goods/orders',   icon: 'receipt',      componentKey: 'digital_goods:OrdersList' },
    { label: 'Settings', path: '/admin/digital-goods/settings', icon: 'settings',     componentKey: 'digital_goods:Settings', permission: 'settings' },
],
```

- [ ] **Step 2: Run the seed against staging**

```bash
cd clicker-platform-v2 && pnpm tsx scripts/seed-modules.ts 2>&1 | tail -10
```

Expected: `✅ Seeded digital_goods` (with the updated routes).

- [ ] **Step 3: Verify the doc in Firestore**

```bash
pnpm tsx -e "
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const key = JSON.parse(fs.readFileSync(process.env.GCP_SERVICE_ACCOUNT_KEY!, 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(key) });
getFirestore().collection('modules').doc('digital_goods').get().then(s => {
  console.log('routes:', (s.data()?.adminRoutes || []).map((r: any) => r.label));
});
" 2>&1 | tail -5
```

Expected: `routes: [ 'Products', 'Orders', 'Settings' ]`.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/scripts/seed-modules.ts
git commit -m "feat(digital_goods): seed Orders route into Firestore module registry"
```

---

### Task 15: End-to-end smoke test

**Files:** (none — manual verification)

- [ ] **Step 1: Restart dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Walk the full purchase flow as a buyer**

Use a known dev tenant subdomain (e.g. `tenant.localhost:3000`).

1. Browse `/store` while logged out → product grid renders.
2. Click a product → detail page shows; "Buy Now" visible.
3. Click "Buy Now" → bounced to `/store/login?next=...` (digital_goods's own login route — NOT membership) → enter email → click magic link → land on `/store/login/verify` → buyer record auto-provisioned → bounced to checkout page.
4. Verify bank instructions display.
5. Add a buyer note → click "Saya sudah transfer" → redirected to `/library/orders/[orderId]` with status "awaiting confirmation".
6. As the tenant (in another browser/incognito as admin), navigate to `/admin/digital-goods/orders` → see the pending order at the top of the table (amber row) → click pencil → slide-over opens with order details → paste an optional bank ref → click "Tandai Lunas".
7. Back in the buyer window, the order status page should **live-update** to "paid" within ~1 second, and a "Lihat di Library →" button should appear.
8. Click → `/library/[entryId]` opens → click "Download PDF" → new tab opens with the signed Firebase URL → PDF downloads/opens.
9. Verify the buyer received a confirmation email at the address used.
10. Verify the tenant received a notification email when the order was placed.

- [ ] **Step 3: Run automated checks**

```bash
pnpm exec tsc --noEmit
pnpm vitest run lib/modules/digital_goods
```

Expected: zero TS errors, all tests pass.

- [ ] **Step 4: No commit (verification only)**

Only mark complete if every step above succeeds. If any step fails, file an issue against the failing task and fix before proceeding.

---

## Done — Plan 2 outcome

After all 16 tasks (15 original + Task 4b login route):
- Buyer can discover (`/store`), browse, log in via magic link, place a manual-transfer order, see live order status, get notified on payment confirmation, and download their PDF (or watch their YouTube embed).
- Tenant can see pending orders, confirm payment with a "Tandai Lunas" action that creates the library entry transactionally, or cancel.
- Email notifications wire both sides (tenant gets new-order notification, buyer gets paid-confirmation with library deep link).
- PDF files are gated by signed URLs (15-minute TTL) — never publicly readable, even with the URL.

**Plan 3 (next, scope on its own):**
- Optional loyalty integration (`addPoints` facade call on order paid, if tenant has membership module enabled)
- PostHog events (`digital_goods.purchase_completed`, `digital_goods.product_published`)
- WhatsApp tenant notification (alongside email)
- Promo/discount code integration via existing `promo` module + `promo_integration` skill
- Refund workflow (out-of-band today; could become first-class)
- Final dogfooding session with the creator

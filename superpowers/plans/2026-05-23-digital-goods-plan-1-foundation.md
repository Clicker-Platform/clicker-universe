# Digital Goods Module — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `superpowers/specs/2026-05-23-digital-goods-module-design.md`

**Goal:** Scaffold the `digital_goods` module end-to-end so a tenant can create, edit, publish, and unpublish digital products (PDF or YouTube), and configure manual-transfer payment settings (bank account + QRIS). No buyer-facing flow yet — that's Plan 2.

**Architecture:** Standard Clicker module pattern (`lib/modules/digital_goods/` with `api.ts`, `constants.ts`, `types.ts`, `admin/`, `components/`). All Firestore data nested under `sites/{siteId}/modules/digital_goods/...`. Storage mirrors this. Registered via `lib/modules/definitions.ts` + `lib/modules/components.tsx` + `scripts/seed-modules.ts` per CLAUDE.md rule #7.

**Tech Stack:** Next.js 14 App Router, Firebase (Auth/Firestore/Storage client SDK), TypeScript, Tailwind, lucide-react icons, existing `lib/upload.ts` for file uploads, Vitest for tests.

**Outcome at end of Plan 1:** Tenant logs into `/admin/digital-goods`, sees an empty products list, clicks "+ New Product," fills the form, uploads a PDF, publishes. Product appears in the list. Tenant configures bank settings. All data lives at correct Firestore paths. Public/buyer flow is **not** built yet (Plan 2).

---

## File Structure

### New files

| Path | Responsibility |
| --- | --- |
| `lib/modules/digital_goods/constants.ts` | Module ID, Firestore collection paths, storage folder, route paths |
| `lib/modules/digital_goods/types.ts` | TypeScript types for Product, Order, LibraryEntry, Settings |
| `lib/modules/digital_goods/api.ts` | Client-side Firestore CRUD: products, settings (Plan 1 only — orders/library in Plan 2) |
| `lib/modules/digital_goods/admin/ProductsListPage.tsx` | Admin route: list of products |
| `lib/modules/digital_goods/admin/ProductEditorPage.tsx` | Admin route: create/edit a product |
| `lib/modules/digital_goods/admin/SettingsPage.tsx` | Admin route: bank details + QRIS upload |
| `lib/modules/digital_goods/admin/components/ProductForm.tsx` | Form component used by editor (title, desc, price, content kind, file/youtube) |
| `lib/modules/digital_goods/admin/components/PdfUploadField.tsx` | PDF upload widget (uses `lib/upload.ts`) |
| `lib/modules/digital_goods/__tests__/api.test.ts` | Vitest for api.ts (slug generation, validation helpers) |
| `lib/modules/digital_goods/__tests__/types.test.ts` | Type-level smoke tests for the schema |
| `scripts/seed-digital-goods-module.ts` | One-shot script to seed `modules/digital_goods` doc in Firestore |

### Modified files

| Path | Change |
| --- | --- |
| `lib/modules/definitions.ts` | Add `digital_goods` static module definition with admin routes |
| `lib/modules/components.tsx` | Register `digital_goods:*` componentKey → component imports |
| `scripts/seed-modules.ts` | Add `digital_goods` entry alongside other modules |
| `firestore.rules` | Add rules for `modules/digital_goods/products|settings` paths (orders/library in Plan 2) |
| `storage.rules` | Add rule for `sites/{siteId}/modules/digital_goods/...` writes (auth-gated) |

### Out of Plan 1 (deferred to Plan 2)
- `app/store/...` (any public storefront routes)
- Order creation, order list admin, manual-confirm flow
- Library entries, signed-URL endpoint
- Resend emails
- Already-purchased guard
- Loyalty integration (Plan 3)

---

## Task 1: Constants file

**Files:**
- Create: `lib/modules/digital_goods/constants.ts`

- [ ] **Step 1: Write the constants file**

Create `lib/modules/digital_goods/constants.ts`:

```ts
// Digital Goods Module — path constants
// Never hardcode these strings elsewhere — always import from here

export const MODULE_ID = 'digital_goods';

// Firestore collection paths (relative to sites/{siteId}/)
export const COLLECTION_PRODUCTS = 'modules/digital_goods/products';
export const COLLECTION_ORDERS   = 'modules/digital_goods/orders';     // Plan 2
export const COLLECTION_LIBRARY  = 'modules/digital_goods/library';    // Plan 2
export const DOC_SETTINGS        = 'modules/digital_goods/settings/config';

// Storage paths (mirrors Firestore)
export const STORAGE_FOLDER_PRODUCTS = 'modules/digital_goods/products';
export const STORAGE_FOLDER_QRIS     = 'modules/digital_goods/settings';
export const MAX_PDF_MB = 50;
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

// Admin route paths
export const ROUTES = {
  list:        '/admin/digital-goods',
  productNew:  '/admin/digital-goods/products/new',
  productEdit: '/admin/digital-goods/products/edit',
  settings:    '/admin/digital-goods/settings',
} as const;

// Permission key (registered in RBAC)
export const PERM_MANAGE = 'digital_goods.manage';

// Defaults
export const DEFAULT_CURRENCY = 'IDR' as const;
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/digital_goods/constants.ts
git commit -m "feat(digital_goods): add module constants"
```

---

## Task 2: Types file

**Files:**
- Create: `lib/modules/digital_goods/types.ts`

- [ ] **Step 1: Write the types file**

Create `lib/modules/digital_goods/types.ts`:

```ts
import { Timestamp } from 'firebase/firestore';

// --- Product ---

export type ProductType = 'single'; // Plan 1. Future: 'single' | 'bundle' | 'course'
export type ContentKind = 'pdf' | 'youtube';
export type ProductStatus = 'draft' | 'published';

export interface PdfFile {
  id: string;
  kind: 'pdf';
  name: string;          // original filename
  storagePath: string;   // Firebase Storage path (not URL)
  sizeBytes: number;
  mimeType: string;
}

export interface YouTubeFile {
  id: string;
  kind: 'youtube';
  url: string;           // canonical youtube.com/watch?v=... URL
  title?: string;        // optional display label
}

export type ProductFile = PdfFile | YouTubeFile;

export interface DigitalProduct {
  id: string;
  type: ProductType;
  title: string;
  description: string;          // markdown supported
  coverImage?: string;          // Firebase Storage path
  price: number;                // integer IDR
  currency: 'IDR';
  contentKind: ContentKind;
  files: ProductFile[];         // Plan 1: length === 1
  slug: string;                 // URL-safe, unique per site
  status: ProductStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

// --- Order (Plan 2 — shape declared here so api/types co-evolve) ---

export type OrderStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'paid'
  | 'cancelled';

export type PaymentMethod = 'manual_transfer'; // Plan 1. Future: | 'midtrans' | 'xendit'

export interface PaymentInstructions {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisImageUrl?: string;
}

export interface ProductSnapshot {
  title: string;
  coverImage?: string;
  price: number;
  currency: 'IDR';
  contentKind: ContentKind;
  type: ProductType;
}

export interface DigitalOrder {
  id: string;
  memberId: string;
  productId: string;
  productSnapshot: ProductSnapshot;
  amount: number;
  currency: 'IDR';
  paymentMethod: PaymentMethod;
  paymentInstructions: PaymentInstructions;
  status: OrderStatus;
  buyerNote?: string;
  paymentRef?: string;
  confirmedBy?: string;
  confirmedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Library Entry (Plan 2) ---

export interface LibraryEntrySnapshot {
  title: string;
  coverImage?: string;
  type: ProductType;
  contentKind: ContentKind;
}

export interface LibraryEntry {
  id: string;
  memberId: string;
  productId: string;
  orderId: string;
  productSnapshot: LibraryEntrySnapshot;
  purchasedAt: Timestamp;
}

// --- Settings ---

export interface DigitalGoodsSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisImageUrl?: string;        // Firebase Storage path
  updatedAt?: Timestamp;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/digital_goods/types.ts
git commit -m "feat(digital_goods): add module types"
```

---

## Task 3: Slug generation helper (TDD)

**Files:**
- Create: `lib/modules/digital_goods/__tests__/api.test.ts`
- Modify: `lib/modules/digital_goods/api.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `lib/modules/digital_goods/__tests__/api.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateSlug } from '../api';

describe('generateSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(generateSlug('Pinjol Survival Kit')).toBe('pinjol-survival-kit');
  });

  it('strips non-alphanumeric characters', () => {
    expect(generateSlug('Hello, World! @2026')).toBe('hello-world-2026');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(generateSlug('a   b---c')).toBe('a-b-c');
  });

  it('trims leading/trailing hyphens', () => {
    expect(generateSlug('  --hello--  ')).toBe('hello');
  });

  it('handles Indonesian characters', () => {
    expect(generateSlug('Belajar Keuangan')).toBe('belajar-keuangan');
  });

  it('returns empty string for input with no alphanumerics', () => {
    expect(generateSlug('---!!!---')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd clicker-platform-v2 && pnpm vitest run lib/modules/digital_goods/__tests__/api.test.ts
```

Expected: FAIL — `Cannot find module '../api'`.

- [ ] **Step 3: Implement minimal api.ts with slug helper**

Create `lib/modules/digital_goods/api.ts`:

```ts
// Digital Goods Module — Firestore API
// All paths from constants.ts. Site-scoped, never hardcoded.

export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')                        // strip diacritics
    .replace(/[̀-ͯ]/g, '')          // remove combining marks
    .replace(/[^a-z0-9\s-]/g, '')             // keep only alphanumerics, spaces, hyphens
    .trim()
    .replace(/[\s-]+/g, '-')                  // collapse spaces/hyphens
    .replace(/^-+|-+$/g, '');                 // trim hyphens
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/modules/digital_goods/__tests__/api.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/modules/digital_goods/api.ts lib/modules/digital_goods/__tests__/api.test.ts
git commit -m "feat(digital_goods): add slug generator with tests"
```

---

## Task 4: Product CRUD API

**Files:**
- Modify: `lib/modules/digital_goods/api.ts`
- Modify: `lib/modules/digital_goods/__tests__/api.test.ts`

- [ ] **Step 1: Add Product CRUD tests**

Append to `lib/modules/digital_goods/__tests__/api.test.ts`:

```ts
import { ensureUniqueSlug } from '../api';

describe('ensureUniqueSlug', () => {
  it('returns input slug when not taken', () => {
    const taken = new Set<string>();
    expect(ensureUniqueSlug('hello', taken)).toBe('hello');
  });

  it('appends -2 when input is taken', () => {
    const taken = new Set(['hello']);
    expect(ensureUniqueSlug('hello', taken)).toBe('hello-2');
  });

  it('keeps incrementing until unique', () => {
    const taken = new Set(['hello', 'hello-2', 'hello-3']);
    expect(ensureUniqueSlug('hello', taken)).toBe('hello-4');
  });

  it('handles empty taken set', () => {
    expect(ensureUniqueSlug('whatever', new Set())).toBe('whatever');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/modules/digital_goods/__tests__/api.test.ts
```

Expected: FAIL — `ensureUniqueSlug` not exported.

- [ ] **Step 3: Implement product CRUD + ensureUniqueSlug**

Replace `lib/modules/digital_goods/api.ts` with:

```ts
// Digital Goods Module — Firestore API
// All paths from constants.ts. Site-scoped, never hardcoded.

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  COLLECTION_PRODUCTS,
  DOC_SETTINGS,
} from './constants';
import {
  DigitalProduct, DigitalGoodsSettings,
} from './types';

// --- Slug helpers ---

export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ensureUniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// --- Products ---

export async function getProducts(siteId: string): Promise<DigitalProduct[]> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_PRODUCTS),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalProduct));
}

export async function getProduct(siteId: string, productId: string): Promise<DigitalProduct | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_PRODUCTS, productId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DigitalProduct;
}

export async function getAllSlugs(siteId: string): Promise<Set<string>> {
  const snap = await getDocs(collection(db, 'sites', siteId, COLLECTION_PRODUCTS));
  return new Set(snap.docs.map(d => (d.data() as DigitalProduct).slug));
}

type NewProduct = Omit<DigitalProduct, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>;

export async function createProduct(siteId: string, data: NewProduct): Promise<string> {
  const ref = await addDoc(collection(db, 'sites', siteId, COLLECTION_PRODUCTS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(data.status === 'published' ? { publishedAt: serverTimestamp() } : {}),
  });
  return ref.id;
}

export async function updateProduct(
  siteId: string,
  productId: string,
  data: Partial<Omit<DigitalProduct, 'id' | 'createdAt'>>
): Promise<void> {
  const current = await getProduct(siteId, productId);
  const wasPublished = current?.status === 'published';
  const willBePublished = data.status === 'published';
  const transitionToPublished = !wasPublished && willBePublished;

  await updateDoc(doc(db, 'sites', siteId, COLLECTION_PRODUCTS, productId), {
    ...data,
    updatedAt: serverTimestamp(),
    ...(transitionToPublished ? { publishedAt: serverTimestamp() } : {}),
  });
}

export async function deleteProduct(siteId: string, productId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, COLLECTION_PRODUCTS, productId));
}

// --- Settings ---

export async function getSettings(siteId: string): Promise<DigitalGoodsSettings | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, DOC_SETTINGS));
  if (!snap.exists()) return null;
  return snap.data() as DigitalGoodsSettings;
}

export async function saveSettings(siteId: string, data: DigitalGoodsSettings): Promise<void> {
  await setDoc(
    doc(db, 'sites', siteId, DOC_SETTINGS),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/modules/digital_goods/__tests__/api.test.ts
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/modules/digital_goods/api.ts lib/modules/digital_goods/__tests__/api.test.ts
git commit -m "feat(digital_goods): product CRUD + settings API"
```

---

## Task 5: Register module in static definitions

**Files:**
- Modify: `lib/modules/definitions.ts`

- [ ] **Step 1: Read current file**

```bash
sed -n '1,20p' lib/modules/definitions.ts
```

Confirm the `STATIC_MODULE_DEFINITIONS` record shape.

- [ ] **Step 2: Add digital_goods entry**

Insert a new key into the `STATIC_MODULE_DEFINITIONS` record (placement: after the `'fintrack'` entry, before the closing `}`). Use exact format:

```ts
    'digital_goods': {
        adminRoutes: [
            { label: 'Products',  path: '/admin/digital-goods',               icon: 'shopping-bag', componentKey: 'digital_goods:ProductsList' },
            { label: 'New Product', path: '/admin/digital-goods/products/new', icon: 'plus',        componentKey: 'digital_goods:ProductEditor', hidden: true },
            { label: 'Edit Product', path: '/admin/digital-goods/products/edit', icon: 'edit',     componentKey: 'digital_goods:ProductEditor', hidden: true },
            { label: 'Settings',  path: '/admin/digital-goods/settings',      icon: 'settings',     componentKey: 'digital_goods:Settings', permission: 'settings' }
        ],
        dashboardAction: { label: 'New Product', href: '/admin/digital-goods/products/new' },
    },
```

- [ ] **Step 3: Verify no TS errors**

```bash
pnpm exec tsc --noEmit
```

Expected: PASS (zero errors related to definitions.ts).

- [ ] **Step 4: Commit**

```bash
git add lib/modules/definitions.ts
git commit -m "feat(digital_goods): register module in static definitions"
```

---

## Task 6: Stub admin page components (so registry won't break)

**Files:**
- Create: `lib/modules/digital_goods/admin/ProductsListPage.tsx`
- Create: `lib/modules/digital_goods/admin/ProductEditorPage.tsx`
- Create: `lib/modules/digital_goods/admin/SettingsPage.tsx`

> These are placeholders so the next task (component registration) compiles. Real implementations come in Tasks 9–12.

- [ ] **Step 1: Create ProductsListPage stub**

Create `lib/modules/digital_goods/admin/ProductsListPage.tsx`:

```tsx
'use client';

export default function ProductsListPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Digital Goods — Products</h1>
      <p className="text-gray-500">Placeholder. Built in Task 9.</p>
    </div>
  );
}
```

- [ ] **Step 2: Create ProductEditorPage stub**

Create `lib/modules/digital_goods/admin/ProductEditorPage.tsx`:

```tsx
'use client';

export default function ProductEditorPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Digital Goods — Product Editor</h1>
      <p className="text-gray-500">Placeholder. Built in Task 10.</p>
    </div>
  );
}
```

- [ ] **Step 3: Create SettingsPage stub**

Create `lib/modules/digital_goods/admin/SettingsPage.tsx`:

```tsx
'use client';

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Digital Goods — Settings</h1>
      <p className="text-gray-500">Placeholder. Built in Task 12.</p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/modules/digital_goods/admin/
git commit -m "feat(digital_goods): scaffold admin page stubs"
```

---

## Task 7: Register components in component map

**Files:**
- Modify: `lib/modules/components.tsx`

- [ ] **Step 1: Add dynamic imports**

Open `lib/modules/components.tsx`. Find the section grouped by module (e.g., "Admin Pages (Service Records)"). Add a new section near the end of the dynamic-import declarations, before the `MODULE_COMPONENTS` record:

```tsx
// Admin Pages (Digital Goods)
const DG_ProductsListPage  = dynamic(() => import('@/lib/modules/digital_goods/admin/ProductsListPage'));
const DG_ProductEditorPage = dynamic(() => import('@/lib/modules/digital_goods/admin/ProductEditorPage'));
const DG_SettingsPage      = dynamic(() => import('@/lib/modules/digital_goods/admin/SettingsPage'));
```

- [ ] **Step 2: Register in MODULE_COMPONENTS**

In the same file, find the `MODULE_COMPONENTS` record and add (alphabetical placement is fine; group with module comment):

```tsx
    // Digital Goods Module
    'digital_goods:ProductsList':   DG_ProductsListPage,
    'digital_goods:ProductEditor':  DG_ProductEditorPage,
    'digital_goods:Settings':       DG_SettingsPage,
```

- [ ] **Step 3: Verify no TS errors**

```bash
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/modules/components.tsx
git commit -m "feat(digital_goods): register admin components in module map"
```

---

## Task 8: Seed the module into Firestore registry

**Files:**
- Modify: `scripts/seed-modules.ts`

- [ ] **Step 1: Add digital_goods to MODULES array**

Open `scripts/seed-modules.ts`. Find the `MODULES` array (starts around line 41). After the last entry (likely `fintrack` or similar), add — matching the existing style:

```ts
    {
        id: 'digital_goods',
        displayName: 'Digital Goods',
        description: 'Sell digital products (PDF, video) with gated buyer library and manual payment.',
        icon: 'shopping-bag',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { label: 'Products',     path: '/admin/digital-goods',          icon: 'shopping-bag', componentKey: 'digital_goods:ProductsList' },
            { label: 'Settings',     path: '/admin/digital-goods/settings', icon: 'settings',     componentKey: 'digital_goods:Settings', permission: 'settings' },
        ],
        collections: [
            'modules/digital_goods/products',
            'modules/digital_goods/orders',
            'modules/digital_goods/library',
        ],
        settings: {}
    },
```

- [ ] **Step 2: Run the seed script against dev/local Firestore**

If the project uses an emulator, ensure it's running first. Otherwise this writes to whichever project the `GCP_SERVICE_ACCOUNT_KEY` env var points at. **Verify project before running:**

```bash
echo "Will seed against project from GCP_SERVICE_ACCOUNT_KEY env var:"
grep GCP_SERVICE_ACCOUNT_KEY .env.local | head -1
```

If this is not the intended target (per the memory note on always confirming Firebase project), stop and confirm with the user. Otherwise:

```bash
pnpm tsx scripts/seed-modules.ts
```

Expected output: seed log shows `digital_goods` added or updated.

- [ ] **Step 3: Verify the doc was written**

Quick check via Firebase console OR via this one-off script:

```bash
pnpm tsx -e "
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
const key = JSON.parse(fs.readFileSync(process.env.GCP_SERVICE_ACCOUNT_KEY!, 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(key) });
const db = getFirestore();
db.collection('modules').doc('digital_goods').get().then(s => {
  console.log('exists:', s.exists);
  console.log('data:', JSON.stringify(s.data(), null, 2));
});
"
```

Expected: `exists: true`, data includes `id: 'digital_goods'` and `enabled: true`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-modules.ts
git commit -m "feat(digital_goods): seed module in Firestore registry"
```

---

## Task 9: Implement Products List page

**Files:**
- Modify: `lib/modules/digital_goods/admin/ProductsListPage.tsx`

- [ ] **Step 1: Replace stub with real implementation**

Replace contents of `lib/modules/digital_goods/admin/ProductsListPage.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ShoppingBag, Pencil, Trash2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { getProducts, deleteProduct } from '../api';
import type { DigitalProduct } from '../types';
import { ROUTES } from '../constants';

export default function ProductsListPage() {
  const { siteId } = useSite();
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setLoading(true);
    getProducts(siteId)
      .then(items => { if (!cancelled) setProducts(items); })
      .catch(e => {
        logger.error('digital_goods.products.load.failed', { siteId, error: e });
        if (!cancelled) setError('Failed to load products.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  async function handleDelete(productId: string) {
    if (!siteId) return;
    try {
      await deleteProduct(siteId, productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (e) {
      logger.error('digital_goods.product.delete.failed', { siteId, productId, error: e });
      setError('Failed to delete product.');
    }
  }

  if (!siteId) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Digital Goods</h1>
          <p className="text-sm text-gray-500">Sell PDFs, videos, and other digital products.</p>
        </div>
        <Link
          href={ROUTES.productNew}
          className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-lg hover:opacity-90"
        >
          <Plus size={16} /> New Product
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : products.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <ShoppingBag size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 font-medium mb-1">No products yet</p>
          <p className="text-sm text-gray-400 mb-4">Create your first digital product to start selling.</p>
          <Link
            href={ROUTES.productNew}
            className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-lg"
          >
            <Plus size={16} /> New Product
          </Link>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-sm text-gray-600">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3">Rp {p.price.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.contentKind.toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      p.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${ROUTES.productEdit}?id=${p.id}`}
                        className="p-2 text-gray-600 hover:text-brand-dark"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="p-2 text-red-500 hover:text-red-700"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

> **Note on delete:** The plan uses a raw button here for brevity. **CLAUDE.md rule #8 requires `<ConfirmButton>` for destructive actions.** Replace the `<button>` block above with `<ConfirmButton>` once you've confirmed its import path. See Task 9b below.

- [ ] **Step 2: Replace delete button with ConfirmButton**

Look up the ConfirmButton import:

```bash
grep -r "ConfirmButton" components/ui/ --include="*.tsx" -l | head -3
```

Open the import path (likely `@/components/ui/ConfirmButton`). Add import at top of `ProductsListPage.tsx`:

```tsx
import { ConfirmButton } from '@/components/ui/ConfirmButton';
```

Replace the `<button type="button" onClick={...}>...<Trash2 .../></button>` with:

```tsx
<ConfirmButton
  onConfirm={() => handleDelete(p.id)}
  className="p-2 text-red-500 hover:text-red-700"
  aria-label="Delete"
>
  <Trash2 size={16} />
</ConfirmButton>
```

If `ConfirmButton`'s actual prop shape differs (it may use children for the label or a different prop name), inspect the file and adapt — the rule is "soft-red Confirm/Cancel pair on first click," not the exact prop names.

- [ ] **Step 3: Manually smoke-test the page**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/admin/digital-goods` while logged in as a tenant admin. Expected: empty state appears with "+ New Product" CTA. No console errors.

- [ ] **Step 4: Commit**

```bash
git add lib/modules/digital_goods/admin/ProductsListPage.tsx
git commit -m "feat(digital_goods): implement products list page"
```

---

## Task 10: Implement PDF upload field component

**Files:**
- Create: `lib/modules/digital_goods/admin/components/PdfUploadField.tsx`

- [ ] **Step 1: Inspect existing upload helper**

```bash
grep -n "export" lib/upload.ts | head -10
```

Confirm the exported function name (likely `uploadToStorage`) and its signature.

- [ ] **Step 2: Write the component**

Create `lib/modules/digital_goods/admin/components/PdfUploadField.tsx`. Adjust the import name in the call if `lib/upload.ts` exports something other than `uploadToStorage`:

```tsx
'use client';

import { useState, useRef } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { uploadToStorage } from '@/lib/upload';
import { logger } from '@/lib/logger-edge';
import { STORAGE_FOLDER_PRODUCTS, MAX_PDF_BYTES, MAX_PDF_MB } from '../../constants';
import type { PdfFile } from '../../types';

interface Props {
  siteId: string;
  value: PdfFile | null;
  onChange: (file: PdfFile | null) => void;
}

export default function PdfUploadField({ siteId, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (file.type !== 'application/pdf') {
      setError('Only PDF files allowed.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`File too large. Max ${MAX_PDF_MB} MB.`);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadToStorage({
        file,
        folder: `${STORAGE_FOLDER_PRODUCTS}/files`,
        siteId,
        convertToWebP: false,
      });
      onChange({
        id: crypto.randomUUID(),
        kind: 'pdf',
        name: file.name,
        storagePath: result.path,   // adjust if uploadToStorage returns a different shape
        sizeBytes: file.size,
        mimeType: file.type,
      });
    } catch (e) {
      logger.error('digital_goods.pdf.upload.failed', { siteId, error: e });
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (value) {
    return (
      <div className="border rounded-lg p-4 flex items-center gap-3 bg-gray-50">
        <FileText className="text-gray-500" size={20} />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{value.name}</div>
          <div className="text-xs text-gray-500">{(value.sizeBytes / 1024 / 1024).toFixed(2)} MB</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1 text-gray-500 hover:text-red-600"
          aria-label="Remove file"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="block border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-brand-dark transition">
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="animate-spin" size={18} /> Uploading...
          </div>
        ) : (
          <>
            <FileText className="mx-auto mb-2 text-gray-400" size={28} />
            <div className="font-medium">Click to upload PDF</div>
            <div className="text-xs text-gray-500 mt-1">Max {MAX_PDF_MB} MB</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}
```

> If `uploadToStorage` from `lib/upload.ts` returns a different shape (e.g., `{ url, path, ref }` or just a URL string), adapt the assignment to `storagePath`. The contract this component requires: a string path that can later be passed to `getDownloadURL` server-side.

- [ ] **Step 3: Commit**

```bash
git add lib/modules/digital_goods/admin/components/PdfUploadField.tsx
git commit -m "feat(digital_goods): PDF upload field component"
```

---

## Task 11: Implement Product Editor page

**Files:**
- Create: `lib/modules/digital_goods/admin/components/ProductForm.tsx`
- Modify: `lib/modules/digital_goods/admin/ProductEditorPage.tsx`

- [ ] **Step 1: Write the ProductForm component**

Create `lib/modules/digital_goods/admin/components/ProductForm.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import {
  getProduct, createProduct, updateProduct,
  generateSlug, ensureUniqueSlug, getAllSlugs,
} from '../../api';
import { ROUTES, DEFAULT_CURRENCY } from '../../constants';
import type {
  DigitalProduct, ContentKind, ProductStatus, PdfFile, YouTubeFile,
} from '../../types';
import PdfUploadField from './PdfUploadField';

interface FormState {
  title: string;
  description: string;
  price: string;                  // string for input control
  contentKind: ContentKind;
  pdfFile: PdfFile | null;
  youtubeUrl: string;
  status: ProductStatus;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  price: '',
  contentKind: 'pdf',
  pdfFile: null,
  youtubeUrl: '',
  status: 'draft',
};

export default function ProductForm() {
  const { siteId } = useSite();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('id');           // null for new product
  const isEdit = Boolean(productId);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<DigitalProduct | null>(null);

  useEffect(() => {
    if (!siteId || !productId) return;
    let cancelled = false;
    setLoading(true);
    getProduct(siteId, productId)
      .then(p => {
        if (cancelled || !p) return;
        setExisting(p);
        const yt = p.files.find(f => f.kind === 'youtube') as YouTubeFile | undefined;
        const pdf = p.files.find(f => f.kind === 'pdf') as PdfFile | undefined;
        setForm({
          title: p.title,
          description: p.description,
          price: String(p.price),
          contentKind: p.contentKind,
          pdfFile: pdf ?? null,
          youtubeUrl: yt?.url ?? '',
          status: p.status,
        });
      })
      .catch(e => {
        logger.error('digital_goods.product.load.failed', { siteId, productId, error: e });
        if (!cancelled) setError('Failed to load product.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId, productId]);

  function validate(): string | null {
    if (!form.title.trim()) return 'Title is required.';
    const priceNum = parseInt(form.price, 10);
    if (!Number.isFinite(priceNum) || priceNum < 0) return 'Price must be a non-negative integer.';
    if (form.contentKind === 'pdf' && !form.pdfFile) return 'Upload a PDF file.';
    if (form.contentKind === 'youtube' && !form.youtubeUrl.match(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//)) {
      return 'Enter a valid YouTube URL.';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const files = form.contentKind === 'pdf'
        ? [form.pdfFile!]
        : [{ id: crypto.randomUUID(), kind: 'youtube' as const, url: form.youtubeUrl }];

      const taken = await getAllSlugs(siteId);
      // If editing, don't conflict with own current slug
      if (isEdit && existing) taken.delete(existing.slug);
      const baseSlug = generateSlug(form.title) || 'product';
      const slug = isEdit && existing && existing.slug === baseSlug
        ? existing.slug
        : ensureUniqueSlug(baseSlug, taken);

      const data = {
        type: 'single' as const,
        title: form.title.trim(),
        description: form.description,
        price: parseInt(form.price, 10),
        currency: DEFAULT_CURRENCY,
        contentKind: form.contentKind,
        files,
        slug,
        status: form.status,
      };

      if (isEdit && productId) {
        await updateProduct(siteId, productId, data);
      } else {
        await createProduct(siteId, data);
      }
      router.push(ROUTES.list);
    } catch (e) {
      logger.error('digital_goods.product.save.failed', { siteId, productId, error: e });
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{isEdit ? 'Edit Product' : 'New Product'}</h1>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Title <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description (markdown supported)</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={6}
          className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Price (IDR) <span className="text-red-500">*</span></label>
        <input
          type="number"
          min="0"
          step="1"
          value={form.price}
          onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Content type</label>
        <div className="flex gap-2">
          {(['pdf', 'youtube'] as const).map(kind => (
            <button
              key={kind}
              type="button"
              onClick={() => setForm(f => ({ ...f, contentKind: kind }))}
              className={`px-4 py-2 rounded-lg border ${
                form.contentKind === kind
                  ? 'bg-brand-dark text-white border-brand-dark'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {kind === 'pdf' ? 'PDF' : 'YouTube (unlisted)'}
            </button>
          ))}
        </div>
      </div>

      {form.contentKind === 'pdf' ? (
        <div>
          <label className="block text-sm font-medium mb-1">PDF file <span className="text-red-500">*</span></label>
          <PdfUploadField
            siteId={siteId!}
            value={form.pdfFile}
            onChange={pdfFile => setForm(f => ({ ...f, pdfFile }))}
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">YouTube URL <span className="text-red-500">*</span></label>
          <input
            type="url"
            value={form.youtubeUrl}
            onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full border rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Set the video to <strong>Unlisted</strong> in YouTube. Public/Private will not work as expected.</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Status</label>
        <div className="flex gap-2">
          {(['draft', 'published'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setForm(f => ({ ...f, status: s }))}
              className={`px-4 py-2 rounded-lg border ${
                form.status === s
                  ? 'bg-brand-dark text-white border-brand-dark'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-dark text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          {isEdit ? 'Save changes' : 'Create product'}
        </button>
        <button
          type="button"
          onClick={() => router.push(ROUTES.list)}
          className="px-6 py-2 rounded-lg border"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Replace ProductEditorPage stub with shell**

Replace contents of `lib/modules/digital_goods/admin/ProductEditorPage.tsx`:

```tsx
'use client';

import { Suspense } from 'react';
import ProductForm from './components/ProductForm';

export default function ProductEditorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ProductForm />
    </Suspense>
  );
}
```

> `Suspense` is required because `ProductForm` uses `useSearchParams`, which Next requires to be wrapped.

- [ ] **Step 3: Manual smoke test — create a product**

Run dev server, navigate to `/admin/digital-goods`, click "+ New Product." Fill in:
- Title: "Test PDF Product"
- Description: "Test desc"
- Price: 10000
- Content type: PDF, upload any small PDF
- Status: Draft

Click "Create product." Expected: redirect to `/admin/digital-goods` with the new product visible in the list.

Then click the edit icon on the new product → form loads with values populated → change title → save → list reflects updated title.

- [ ] **Step 4: Commit**

```bash
git add lib/modules/digital_goods/admin/components/ProductForm.tsx lib/modules/digital_goods/admin/ProductEditorPage.tsx
git commit -m "feat(digital_goods): implement product editor"
```

---

## Task 12: Implement Settings page (bank details + QRIS)

**Files:**
- Modify: `lib/modules/digital_goods/admin/SettingsPage.tsx`

- [ ] **Step 1: Replace stub with real implementation**

Replace contents of `lib/modules/digital_goods/admin/SettingsPage.tsx`:

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, Image as ImageIcon, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { uploadToStorage } from '@/lib/upload';
import { getSettings, saveSettings } from '../api';
import { STORAGE_FOLDER_QRIS } from '../constants';
import type { DigitalGoodsSettings } from '../types';

export default function SettingsPage() {
  const { siteId } = useSite();
  const [settings, setSettings] = useState<DigitalGoodsSettings>({
    bankName: '',
    accountNumber: '',
    accountName: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQris, setUploadingQris] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const qrisInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    getSettings(siteId)
      .then(s => { if (!cancelled && s) setSettings(s); })
      .catch(e => logger.error('digital_goods.settings.load.failed', { siteId, error: e }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  async function handleQrisUpload(file: File) {
    if (!siteId) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ kind: 'err', text: 'QRIS must be an image.' });
      return;
    }
    setUploadingQris(true);
    setMessage(null);
    try {
      const result = await uploadToStorage({ file, folder: STORAGE_FOLDER_QRIS, siteId });
      setSettings(s => ({ ...s, qrisImageUrl: result.path }));
    } catch (e) {
      logger.error('digital_goods.qris.upload.failed', { siteId, error: e });
      setMessage({ kind: 'err', text: 'QRIS upload failed.' });
    } finally {
      setUploadingQris(false);
      if (qrisInputRef.current) qrisInputRef.current.value = '';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    if (!settings.bankName.trim() || !settings.accountNumber.trim() || !settings.accountName.trim()) {
      setMessage({ kind: 'err', text: 'Bank name, account number, and account name are required.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings(siteId, settings);
      setMessage({ kind: 'ok', text: 'Settings saved.' });
    } catch (e) {
      logger.error('digital_goods.settings.save.failed', { siteId, error: e });
      setMessage({ kind: 'err', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <form onSubmit={handleSave} className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Digital Goods — Payment Settings</h1>
        <p className="text-sm text-gray-500">Buyers will see these details on the checkout page.</p>
      </div>

      {message && (
        <div className={`p-3 rounded border ${
          message.kind === 'ok'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>{message.text}</div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Bank name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={settings.bankName}
          onChange={e => setSettings(s => ({ ...s, bankName: e.target.value }))}
          placeholder="e.g. BCA"
          className="w-full border rounded-lg px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Account number <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={settings.accountNumber}
          onChange={e => setSettings(s => ({ ...s, accountNumber: e.target.value }))}
          placeholder="e.g. 1234567890"
          className="w-full border rounded-lg px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Account holder name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={settings.accountName}
          onChange={e => setSettings(s => ({ ...s, accountName: e.target.value }))}
          placeholder="e.g. Andre Setiawan"
          className="w-full border rounded-lg px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">QRIS image (optional)</label>
        {settings.qrisImageUrl ? (
          <div className="border rounded-lg p-3 flex items-center gap-3 bg-gray-50">
            <ImageIcon className="text-gray-500" size={20} />
            <div className="flex-1 text-sm text-gray-700 truncate">{settings.qrisImageUrl}</div>
            <button
              type="button"
              onClick={() => setSettings(s => ({ ...s, qrisImageUrl: undefined }))}
              className="p-1 text-gray-500 hover:text-red-600"
              aria-label="Remove QRIS image"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <label className="block border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-brand-dark">
            {uploadingQris ? (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={18} /> Uploading...
              </div>
            ) : (
              <>
                <ImageIcon className="mx-auto mb-2 text-gray-400" size={24} />
                <div className="text-sm">Click to upload QRIS image</div>
              </>
            )}
            <input
              ref={qrisInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingQris}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleQrisUpload(f);
              }}
            />
          </label>
        )}
      </div>

      <div className="pt-4 border-t">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-dark text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          Save settings
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Run dev server, navigate to `/admin/digital-goods/settings`. Fill in bank details. Optionally upload a QRIS image. Click "Save settings." Expected: green "Settings saved" message; refresh page → values persist.

- [ ] **Step 3: Commit**

```bash
git add lib/modules/digital_goods/admin/SettingsPage.tsx
git commit -m "feat(digital_goods): implement settings page (bank + QRIS)"
```

---

## Task 13: Firestore security rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Inspect existing module rule patterns**

```bash
grep -n "modules/membership\|modules/byod_pos" firestore.rules | head -10
```

Understand the pattern other modules use for `sites/{siteId}/modules/...` paths.

- [ ] **Step 2: Add digital_goods rules**

Open `firestore.rules`. Inside the `match /sites/{siteId} { ... }` block (or wherever per-tenant collection rules live), add:

```javascript
// Digital Goods Module
match /modules/digital_goods/products/{productId} {
  // Public can read PUBLISHED products only
  allow read: if resource.data.status == 'published'
              || (request.auth != null && isAdmin(siteId));
  // Admins only for writes
  allow write: if request.auth != null && isAdmin(siteId);
}

match /modules/digital_goods/settings/{docId} {
  allow read, write: if request.auth != null && isAdmin(siteId);
}

// Reserved for Plan 2 (orders + library). Commented out until Plan 2.
// match /modules/digital_goods/orders/{orderId} { ... }
// match /modules/digital_goods/library/{entryId} { ... }
```

> `isAdmin(siteId)` is the existing helper used by other module rules. If the helper is named differently (e.g., `isMember(siteId, 'admin')` or `isSiteAdmin(siteId)`), adapt accordingly. Grep first to confirm.

- [ ] **Step 3: Deploy rules to dev/staging**

Per the user's memory rule, **always confirm Firebase project before deploying.**

```bash
firebase use --add   # if no project set
# Confirm the target with the user before next step.
firebase deploy --only firestore:rules --project clicker-universe-stagging
```

(Use the staging project — `clicker-universe-stagging`, double-g. Per the user's stored memory rule.)

Expected output: `Deploy complete!`

- [ ] **Step 4: Smoke test rules with admin user**

In the dev browser logged in as a tenant admin, navigate to `/admin/digital-goods`. Confirm products list still loads (admin can read). Navigate to `/admin/digital-goods/settings`. Confirm settings load and save (admin can read/write).

Then open an incognito window (no auth). Try to access Firestore directly via a browser console one-liner:

```js
// In dev console of incognito tab on tenant.localhost:3000
firebase.firestore().collection(`sites/<siteId>/modules/digital_goods/products`).get()
  .then(s => console.log('docs:', s.docs.map(d => d.data().title)))
  .catch(e => console.log('blocked:', e.code));
```

Expected: only published products returned. Drafts blocked.

(If `firebase` global isn't available, this step can be deferred to integration tests in Plan 3.)

- [ ] **Step 5: Commit**

```bash
git add firestore.rules
git commit -m "feat(digital_goods): firestore security rules for products + settings"
```

---

## Task 14: Storage rules

**Files:**
- Modify: `storage.rules`

- [ ] **Step 1: Inspect current storage rules**

```bash
cat storage.rules
```

Confirm the current rule set. The default `sites/{siteId}/{allPaths=**}` rule already covers writes (auth-required) and public read. **Storage rules likely don't need changes** because PDFs are served via signed URLs (Plan 2), not direct public reads — but admin upload writes are already allowed by the existing site-scoped rule.

- [ ] **Step 2: Decide — no change needed for Plan 1**

If the current rule `match /sites/{siteId}/{allPaths=**} { allow read: if true; allow write: if isAuthenticated(); }` is present, **no change required** for Plan 1.

Plan 2 will tighten this for PDF files specifically (signed URL only, no public read). Document the decision:

```bash
# No file change. Verify with:
grep -A 3 "sites/{siteId}" storage.rules
```

- [ ] **Step 3: No commit (no change)**

If a change is genuinely needed (e.g., the existing rule doesn't cover the case), make it minimally and commit:

```bash
git add storage.rules && git commit -m "feat(digital_goods): allow tenant uploads to module storage path"
```

Otherwise, skip and proceed to Task 15.

---

## Task 15: End-to-end smoke test

**Files:** (none — manual verification)

- [ ] **Step 1: Start fresh dev session**

```bash
pnpm dev
```

- [ ] **Step 2: Log in as tenant admin**

Use existing auth-gateway flow to log into a known dev tenant site.

- [ ] **Step 3: Walk the full Plan 1 flow**

1. Navigate to `/admin/digital-goods`. Confirm:
   - Page renders, sidebar nav shows "Products" (and "Settings" if RBAC permits).
   - Empty state appears if no products yet.
2. Click "+ New Product":
   - Fill all fields, upload a PDF (~1 MB).
   - Set status to Published.
   - Save → redirect to products list.
3. Confirm new product appears in list with status badge "published."
4. Click edit icon:
   - Form loads with values populated.
   - Change title, save → list reflects updated title.
5. Click delete icon → ConfirmButton appears → click Confirm → product removed from list.
6. Navigate to `/admin/digital-goods/settings`:
   - Fill bank details, optionally upload QRIS.
   - Save → green confirmation.
   - Refresh → values persist.
7. Open browser DevTools → Firestore tab → navigate to `sites/<siteId>/modules/digital_goods/products`. Confirm document shape matches the type defined in `types.ts`.

- [ ] **Step 4: Run TypeScript + tests**

```bash
pnpm exec tsc --noEmit
pnpm vitest run lib/modules/digital_goods
```

Expected: zero errors, all tests pass.

- [ ] **Step 5: No commit (verification only)**

Mark this task complete only if every step above succeeds. If any step fails, fix the underlying issue and re-run before proceeding.

---

## Task 16: Update the digital_goods skill (project doc)

**Files:**
- Create or modify: `.claude/commands/digital_goods.md` (if a skill file exists for this project)
- Create or modify: project's `AGENTS.md` / `.agents/README.md` index (if applicable)

- [ ] **Step 1: Check whether a skill file exists**

```bash
ls .claude/commands/ | grep -i digital
```

If a `digital_goods.md` skill already exists, modify it. If not, create one matching the pattern of an existing module skill (e.g., `cat .claude/commands/membership.md`).

- [ ] **Step 2: Document Plan 1 state**

Write a short skill file that covers:
- Module ID, paths, routes (from `constants.ts`).
- "Plan 1 shipped" — what works today (admin CRUD + settings).
- "Plan 2 pending" — what doesn't work (no buyer-facing flow, no orders, no library).
- Where the spec lives: `superpowers/specs/2026-05-23-digital-goods-module-design.md`.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/digital_goods.md
git commit -m "docs(digital_goods): add skill file documenting Plan 1 state"
```

---

## Done — Plan 1 outcome

Tenant can:
- See an empty products list at `/admin/digital-goods`.
- Create a product (PDF or YouTube URL), set price, mark as draft or published.
- Edit and delete products.
- Configure bank account + QRIS for future buyer checkout.

Data lives at correct Firestore paths under `sites/{siteId}/modules/digital_goods/`. Files in Firebase Storage at the mirrored path. Security rules enforce admin-only writes and public read for published products.

**Plan 2 (next)** wires the buyer side: `/store` catalog, `/store/[slug]` detail page, checkout, order creation, manual-confirm flow in admin, library, signed-URL endpoint, emails.

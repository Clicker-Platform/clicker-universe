# Post-merge follow-up — Digital Goods (Plan 2)

**Merged into `dev`:** 2026-05-25, merge commit `c3694ee`
**Source branch:** `feat/digital-goods-plan-2`
**Status:** MVP shipped — purchase flow verified working end-to-end on staging for tenant `go`

---

## What's already live on staging (`clicker-universe-stagging`)

- Firestore rules (buyers, orders, library — deployed)
- 5 composite Firestore indexes (deployed)
- Module registry `modules/digital_goods` seeded with 3 admin routes + ProductGrid block exposed
- Tenant `go` has module enabled + has the auto-created Store custom page

## What still needs doing (in priority order)

### 1. Deploy storage rules to staging

Defense-in-depth — currently, direct-read of PDF storage paths isn't blocked at the storage layer. Signed URL flow works fine, but missing the explicit deny rule.

```bash
cd clicker-platform-v2 && firebase deploy --only storage --project clicker-universe-stagging
```

### 2. Configure Resend templates

Two email aliases need to exist in Resend (or be overridden in Firestore email config):
- `digital-goods-new-order-tenant` (notifies tenant of new order)
- `digital-goods-order-paid-buyer` (notifies buyer that order is confirmed, includes library link)

Template variables used:
- New order tenant: `orderId`, `buyerEmail`, `productTitle`, `amount`
- Order paid buyer: `productTitle`, `libraryUrl`

Until configured, both emails silently no-op (caught in `.catch()`). Module is functional without them — buyer sees live status via Firestore onSnapshot.

### 3. Deploy Cloud Function for auto-page creation

When a new tenant enables `digital_goods` via Backyard, a "Store" custom page should be auto-created. The Cloud Function code is in `functions/src/admin/modules/seeding.ts` and is wired to the `updateTenantModules` callable.

**Blocker:** local environment is Node 24; functions require Node 22. See `superpowers/notes/2026-05-25-deferred-cf-deploy.md` for full instructions.

**Workaround until deployed:** when a new tenant enables the module, manually create the Store page via this one-off script:

```bash
cd clicker-platform-v2 && npx tsx -e "
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const key = JSON.parse(fs.readFileSync(process.env.GCP_SERVICE_ACCOUNT_KEY!, 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(key) });
const db = getFirestore();
const SITE_ID = 'REPLACE_WITH_TENANT_ID';
db.doc(\`sites/\${SITE_ID}/pages/digital-goods-store\`).set({
  id: 'digital-goods-store',
  title: 'Store',
  slug: 'store',
  content: '',
  blocks: [{
    id: 'product-grid-default',
    type: 'digital_goods_product_grid',
    data: { title: 'Store', subtitle: 'Browse and buy digital products.', limit: 12, columns: 3 },
  }],
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
"
```

### 4. Buy Now login-loop UX polish (P2)

`StoreProductClient` checks `useAuthState(auth)` — Firebase client state — which doesn't always rehydrate quickly on fresh browser sessions. Result: even logged-in buyers get sent through the login flow on every fresh tab.

**Fix:** drop the client-side `useAuthState` check, always navigate to `/checkout`, let the server-side checkout page handle auth (it already redirects to login if `__session` cookie is missing). The "already purchased" guard would still need the client check, but for unauthenticated users it just won't run and they'll see Buy Now → log in at checkout.

File: `app/[tenant]/store/[slug]/StoreProductClient.tsx`

### 5. Cleanup: dead code

`lib/modules/digital_goods/auto-page.ts` lives in the platform repo but is never imported. The Cloud Function in `functions/src/admin/modules/seeding.ts` owns the seeding logic. Either:
- Delete `auto-page.ts` (cleanest)
- Or add a comment explaining it's a parallel implementation kept for direct server-action use

### 6. Production preflight (when ready to deploy to prod)

When deploying digital_goods to production for the first time:
- Deploy firestore rules to prod
- Deploy storage rules to prod
- Deploy composite indexes to prod (`firebase deploy --only firestore:indexes --project <prod>`)
- Run `pnpm tsx scripts/seed-modules.ts` against prod (after pointing service account key at prod)
- Deploy Cloud Function for auto-page creation
- Configure Resend templates in the prod-aware way
- Test in a staging tenant before enabling for paying customers

## Architectural notes (worth remembering)

- **All tenant-scoped public routes live under `app/[tenant]/`**, not at app root. Memory entry saved: `feedback_tenant_routes_under_tenant.md`. This applies to any future module with buyer/visitor surfaces.
- **The `membership` module is loyalty-only.** Digital Goods owns its own `/store/login` route — do NOT couple new modules to membership for identity. Memory entry: `feedback_membership_is_loyalty_only.md`. CLAUDE.md rule 10.
- **Module registry block exposure is separate from code registration.** Adding a block to `BlockRenderer.tsx` is necessary but not sufficient — the block must also be listed in `modules/{id}.blocks` array (set via `scripts/seed-modules.ts` and re-seeded after changes).
- **Cover images use full URLs from MediaPicker**, not Firebase Storage paths. The phantom `/api/storage-image?path=...` route doesn't exist; renderers now use the URL directly.

## Known good test path on staging

Tenant: `go` (`http://localhost:3000/go` or staging equivalent)

1. `/go/store` → ProductGrid shows published products
2. Click product → `/go/store/{slug}` → "Buy Now"
3. Unauth → `/go/store/login` → magic link → `/go/store/login/verify` → returns to checkout
4. `/go/store/{slug}/checkout` → "Saya sudah transfer" → `/go/library/orders/{id}`
5. Admin (different session) at `/admin/digital-goods/orders` → pending banner → pencil → "Tandai Lunas"
6. Buyer's `/go/library/orders/{id}` flips to paid live (no refresh) → "Lihat di Library" button appears
7. `/go/library/{entryId}` → "Download PDF" → signed URL opens in new tab

## Plan 3 (future, not started)

- Product bundles (multiple files per product, or grouped purchases)
- Promo integration (apply discount codes at checkout via PromoApplicator)
- Refunds (admin-initiated, with library entry revocation)
- Automatic payment (Xendit or Midtrans) — replaces manual confirm flow

When picking up Plan 3, brainstorm first; don't reuse Plan 2 patterns blindly for the payment integration.

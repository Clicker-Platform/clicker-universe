---
name: inventory
description: >
  Work with the inventory module in the Clicker Platform — stock management, audit trails,
  and POS integration. Use this skill when adding API functions, debugging stock deduction,
  auditing module registration, or wiring inventory into another module.
  Trigger on: "inventory module", "stock management", "stock deduction", "low stock",
  "stock history", "inventory item", "updateStock", "linkedPosItemId",
  or any request touching lib/modules/inventory/.
---

# /inventory — Clicker Platform Inventory Module Skill

You are helping work with the inventory module — stock management with atomic transaction recording for restaurant and retail tenants.

This skill is invoked as `/inventory [action]`

---

## Actions

| Action | Usage | Purpose |
|--------|-------|---------|
| `audit` | `/inventory audit` | Verify registration, Firestore paths, and composite index |
| `add-api` | `/inventory add-api` | Add a new API function following module patterns |
| `integrate` | `/inventory integrate {moduleId}` | Wire inventory into another module using the dynamic import pattern |
| `debug` | `/inventory debug` | Diagnose stock deduction, transaction history, and linking issues |

---

## Action: `audit`

Read the following files and check each point. Report pass/fail with the exact file path.

**Checklist:**

1. Directory `lib/modules/inventory/` exists with: `api.ts`, `types.ts`, `admin/`

2. `api.ts` defines collection path constants at top-of-file scope:
   ```
   INVENTORY_COLLECTION = 'modules/inventory/items'
   TRANSACTIONS_COLLECTION = 'modules/inventory/transactions'
   ```
   Verify these strings exactly — they are relative and get prepended with `sites/{siteId}/` at call time

3. Entry exists in `dev/clicker-platform-v2/lib/modules/definitions.ts` → `STATIC_MODULE_DEFINITIONS['inventory']`:
   - Route: `inventory:AdminDashboard` → `/admin/inventory/items`

4. Entry exists in `dev/backyard/lib/modules/definitions.ts` with `displayName: 'Inventory'`, `description: 'Stock management'`:
   - Route: `inventory:AdminDashboard` → `/admin/inventory`
   - **Note:** Backyard uses `/admin/inventory` (no `/items` suffix) — this is an intentional discrepancy, not a bug

5. `inventory:AdminDashboard` is registered in `lib/modules/components.tsx`:
   - Dynamic import: `const InventoryAdminPage = dynamic(() => import('@/lib/modules/inventory/admin/InventoryAdminPage'))`
   - Entry in `MODULE_COMPONENTS`: `'inventory:AdminDashboard': InventoryAdminPage`

6. No inventory entries in `lib/modules/client-registry.tsx` — inventory is admin-only, no public blocks

7. Entry exists in `scripts/seed-modules.ts` MODULES array for `inventory`

8. `InventoryAdminPage.tsx` has `'use client'` directive at top

9. No `firebase-admin` imports in `lib/modules/inventory/api.ts` (client SDK only)

10. **Composite index:** `getInventoryTransactions` uses `where('itemId') + orderBy('timestamp', 'desc')` — requires a composite index in Firebase. Verify it exists (Firestore → Indexes → Composite). If missing, StockHistoryDrawer will fail on first load with a console error link to create it.

11. `sites/{siteId}.modules.inventory` must be `true` in Firestore for the module to appear in sidebar

---

## Action: `add-api`

Collect from the user:

1. **Function name** — camelCase (e.g. `getLowStockItems`)
2. **Purpose** — what it queries or mutates
3. **Input/output types** — reference `types.ts` first; add new interfaces there if needed

### Read Pattern (api.ts)

```typescript
import {
    collection, query, where, getDocs, orderBy, limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { InventoryItem } from './types';

const INVENTORY_COLLECTION = 'modules/inventory/items';

/**
 * Brief description.
 */
export async function {functionName}(siteId: string): Promise<InventoryItem[]> {
    if (!siteId || siteId === 'default' || siteId === 'pending') return [];

    const q = query(
        collection(db, 'sites', siteId, INVENTORY_COLLECTION),
        where('currentStock', '<=', 5),
        orderBy('currentStock')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
}
```

### Write / Stock-Update Pattern (api.ts)

All stock changes MUST use `runTransaction()` to atomically update both the item and the transaction record:

```typescript
import {
    doc, collection, runTransaction, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TransactionReason } from './types';

const INVENTORY_COLLECTION = 'modules/inventory/items';
const TRANSACTIONS_COLLECTION = 'modules/inventory/transactions';

export async function {functionName}(
    siteId: string,
    itemId: string,
    change: number,             // Positive = add stock, negative = deduct
    reason: TransactionReason,
    referenceId?: string,       // e.g. order ID
    notes?: string
): Promise<void> {
    const itemRef = doc(db, 'sites', siteId, INVENTORY_COLLECTION, itemId);
    const newTransactionRef = doc(collection(db, 'sites', siteId, TRANSACTIONS_COLLECTION));

    await runTransaction(db, async (transaction) => {
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) throw new Error(`Inventory item ${itemId} not found`);

        const data = itemSnap.data();
        const newStock = (data.currentStock || 0) + change;

        transaction.update(itemRef, {
            currentStock: newStock,
            updatedAt: serverTimestamp()
        });

        transaction.set(newTransactionRef, {
            itemId,
            itemName: data.name,  // Denormalized — never query item doc for display
            change,
            reason,
            referenceId: referenceId || null,
            notes: notes || null,
            performedBy: 'System',  // Or pass current user
            timestamp: serverTimestamp()
        });
    });
}
```

### Adding New Types (types.ts)

```typescript
// Extend the TransactionReason union if needed:
export type TransactionReason = "purchase" | "sale" | "adjustment" | "waste" | "return" | "{newReason}";

// New interface:
export interface {NewType} {
    id: string;
    // fields...
}
```

**Rules:**
- Always guard against `siteId === 'default'` or `'pending'`
- Use `INVENTORY_COLLECTION` and `TRANSACTIONS_COLLECTION` constants — never inline path strings
- `itemName` MUST be denormalized into every `StockTransaction` — do not join back to the item doc for display
- Stock changes of any kind MUST go through `updateStock` (or replicate its `runTransaction` pattern) — direct `updateDoc` on `currentStock` bypasses the audit trail
- Never import `firebase-admin` in `api.ts`

---

## Action: `integrate`

To wire inventory into another module `{moduleId}`, follow this strict pattern:

### Step 1 — Guard with isModuleEnabled

Always check before doing anything:

```typescript
import { isModuleEnabled } from '@/lib/modules/registry';

const inventoryEnabled = await isModuleEnabled('inventory');
if (!inventoryEnabled) return; // Silently skip — inventory may not be active for this site
```

### Step 2 — Dynamic Import (never static)

```typescript
// CORRECT: runtime import, prevents loading inventory code when module is off
const { updateStock, getInventory } = await import('@/lib/modules/inventory/api');

// WRONG: static import creates a hard dependency
import { updateStock } from '@/lib/modules/inventory/api';
```

### Step 3 — Stock Deduction Pattern

When an event in `{moduleId}` should deduct stock:

```typescript
async function deductStockForEvent(
    siteId: string,
    items: { inventoryId?: string; name: string; quantity: number }[],
    referenceId: string
) {
    const inventoryEnabled = await isModuleEnabled('inventory');
    if (!inventoryEnabled) return;

    const { updateStock } = await import('@/lib/modules/inventory/api');

    for (const item of items) {
        if (item.inventoryId) {  // Only deduct if item has an inventory link
            try {
                await updateStock(siteId, item.inventoryId, -item.quantity, 'sale', referenceId, '{ModuleId} Event');
            } catch (e) {
                console.error(`Failed to deduct stock for ${item.name}:`, e);
                // Do NOT block the primary operation — stock failures are non-fatal
            }
        }
    }
}
```

### Step 4 — Stock Refund Pattern

When an event is cancelled and stock should be restored:

```typescript
async function refundStockForEvent(
    siteId: string,
    items: { inventoryId?: string; name: string; quantity: number }[],
    referenceId: string
) {
    const inventoryEnabled = await isModuleEnabled('inventory');
    if (!inventoryEnabled) return;

    const { updateStock } = await import('@/lib/modules/inventory/api');

    for (const item of items) {
        if (item.inventoryId) {
            try {
                await updateStock(siteId, item.inventoryId, item.quantity, 'return', referenceId, '{ModuleId} Cancellation');
            } catch (e) {
                console.error(`Failed to refund stock for ${item.name}:`, e);
            }
        }
    }
}
```

### Step 5 — Fetch Inventory for UI Linking

When `{moduleId}` has an admin form where staff link items to inventory:

```typescript
// In a 'use client' admin component:
const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

useEffect(() => {
    if (!siteId) return;
    isModuleEnabled('inventory').then(enabled => {
        if (enabled) {
            import('@/lib/modules/inventory/api').then(({ getInventory }) => {
                getInventory(siteId).then(setInventoryItems);
            });
        }
    });
}, [siteId]);

// In the form JSX:
<select
    value={formData.inventoryId || ''}
    onChange={e => setFormData({ ...formData, inventoryId: e.target.value })}
>
    <option value="">-- No inventory link --</option>
    {inventoryItems.map(i => (
        <option key={i.id} value={i.id}>{i.name} (stock: {i.currentStock} {i.unit})</option>
    ))}
</select>
```

### Step 6 — Declare Dependency in Seed

In `scripts/seed-modules.ts`, add `'inventory'` to the `requires` array for `{moduleId}`:

```typescript
{
    id: '{moduleId}',
    requires: ['inventory'],
    // ...
}
```

### Inventory Item Lookup Priority

When building an inventory map from POS/catalog items, use this priority order:

```
1. Direct inventoryId on item/variant  →  exact match (most reliable)
2. linkedPosItemId on InventoryItem    →  explicit link set by staff in inventory form
3. Name match (inventoryItem.name === posItem.name)  →  last-resort fallback only
```

---

## Action: `debug`

Ask the user which symptom they are seeing.

---

### Symptom: Stock not deducting when POS order completes

1. Check `item.inventoryId` is populated on `CartItem` objects in the order:
   - Inspect the order in Firestore: `sites/{siteId}/modules/byod_pos/orders/{orderId}` → `items[].inventoryId`
   - If `inventoryId` is absent, deduction is silently skipped — no error is thrown

2. Trace the link setup:
   - Firestore: `sites/{siteId}/modules/inventory/items/{itemId}` → check `linkedPosItemId`
   - If `linkedPosItemId` is set, confirm it matches the POS menu item's document ID
   - Linking is resolved at order-create time in `MenuGrid.tsx` — changing the link after an order is placed has no effect on that order

3. Check `isModuleEnabled('inventory')` returns `true`:
   - Global: `modules/inventory.enabled === true` (Firestore, not per-site)
   - Per-site sidebar: `sites/{siteId}.modules.inventory === true`
   - Stock deduction uses the global check — per-site flag controls the sidebar only

4. Deduction fires on `pending → preparing` (KDS status change), NOT at order creation:
   - If the order was never moved to "Preparing" in KDS, no deduction happened

5. Check browser console for `Failed to deduct stock for {itemName}` — deduction errors are caught and logged, never surfaced in UI

---

### Symptom: StockHistoryDrawer shows error or empty history

1. `getInventoryTransactions` requires a **composite Firestore index** on `[itemId ASC, timestamp DESC]`:
   - The Firestore error in console includes a direct link to create it
   - After creating, wait ~2 minutes for the index to build, then retry

2. If the drawer shows "No stock movements found" but adjustments were made:
   - Confirm adjustments went through `updateStock()` — direct `updateDoc` on `currentStock` does NOT write to the transactions collection
   - Check `sites/{siteId}/modules/inventory/transactions` in Firestore console directly, filter by `itemId`

---

### Symptom: Cannot delete an inventory item (blocked by active orders)

The delete check queries orders with `status in ['pending', 'preparing', 'ready']` then client-side filters `items.some(item => item.inventoryId === deleteId)`:

1. Confirm there are no active orders in Firestore: `sites/{siteId}/modules/byod_pos/orders` filtered by those statuses
2. `completed` and `cancelled` orders do NOT block deletion
3. If no active orders exist but deletion still throws, check browser console for the actual error (may be Firestore rules, not a conflict)

---

### Symptom: Inventory items not showing in POS menu link dropdown

The dropdown in `InventoryItemForm` is populated by `InventoryAdminPage` fetching via `getInventory(siteId)`:

1. Verify `isModuleEnabled('inventory')` returns true
2. Verify items exist: `sites/{siteId}/modules/inventory/items` in Firestore
3. If `getInventory` returns empty, check Firestore rules allow authenticated admin reads

---

### Symptom: Low stock badge not appearing

The UI checks `item.currentStock <= item.lowStockThreshold`:

1. Check `lowStockThreshold` on the item in Firestore — may be `0`, meaning badge only shows at stock 0
2. There are **no automated alerts or notifications** — low stock is display-only in the admin UI

---

## Critical File Paths

```
MODULE CORE (dev/clicker-platform-v2/lib/modules/inventory/):
  types.ts                              ← InventoryItem, StockTransaction, TransactionReason
  api.ts                                ← getInventory, getInventoryItem, createInventoryItem,
                                          updateStock (runTransaction), getInventoryTransactions
                                          Also defines: INVENTORY_COLLECTION, TRANSACTIONS_COLLECTION

ADMIN SCREENS (lib/modules/inventory/admin/):
  InventoryAdminPage.tsx                ← componentKey: inventory:AdminDashboard, route: /admin/inventory/items
                                          Handles: list, create/edit, adjust stock, history drawer, delete
  InventoryItemForm.tsx                 ← Modal: name, SKU, unit, initialStock, lowStockThreshold, linkedPosItemId
  AdjustStockDialog.tsx                 ← Modal: quantity + reason (purchase/sale/adjustment/waste/return)
  StockHistoryDrawer.tsx                ← Side drawer: transaction list per item (getInventoryTransactions)
  InventorySkeleton.tsx                 ← Loading placeholder

REGISTRATION FILES:
  lib/modules/definitions.ts            ← STATIC_MODULE_DEFINITIONS['inventory'] → /admin/inventory/items
  lib/modules/components.tsx            ← MODULE_COMPONENTS['inventory:AdminDashboard']
  scripts/seed-modules.ts               ← Firestore module seed (uses /admin/inventory — intentionally differs)
  dev/backyard/lib/modules/definitions.ts  ← Uses /admin/inventory (no /items suffix) — intentional

INTEGRATION CONSUMERS:
  lib/modules/byod_pos/api.ts           ← updateStock() on order completion (deduct) and cancellation (refund)
  lib/modules/byod_pos/api-server.ts    ← Fetches inventory via Admin SDK for SSR inventory map
  lib/modules/byod_pos/components/MenuGrid.tsx  ← Builds inventory lookup maps (byLink + byName)
  lib/modules/byod_pos/admin/menu/POSMenuClient.tsx  ← Fetches inventory for linkedPosItemId dropdown
  lib/modules/registry.ts               ← isModuleEnabled() — guard used before every inventory call
```

---

## Architecture Rules (never violate)

- `InventoryAdminPage.tsx` MUST have `'use client'` at top — served via ModuleLoader in a client context
- `siteId` MUST come from `useSite()` — never hardcode or accept as prop
- NEVER import `firebase-admin` in `api.ts` — client SDK only
- All stock mutations MUST use `runTransaction()` to atomically update `currentStock` AND write a `StockTransaction` record — direct `updateDoc` on `currentStock` is prohibited (breaks the audit trail)
- `itemName` MUST be denormalized into every `StockTransaction` at write time — never join back to the item document for history display
- Always guard cross-module inventory calls with `isModuleEnabled('inventory')` before dynamic import — never assume the module is active
- Always use dynamic `await import('@/lib/modules/inventory/api')` from other modules — never static import (prevents loading when disabled, avoids circular deps)
- `getInventoryTransactions` requires a composite Firestore index on `[itemId ASC, timestamp DESC]` — missing index causes a console error with a creation link
- `linkedPosItemId` on `InventoryItem` is the preferred link mechanism; name-matching is a fallback only
- Stock deduction/refund failures must NEVER block the primary operation — always wrap in try/catch, log the error, and continue
- `sites/{siteId}.modules.inventory` must be `true` in Firestore for the module to appear in sidebar — global `modules/inventory.enabled` alone is not sufficient
- Mutations (Create, Update, Delete, Adjust) MUST be guarded by `!isViewOnly` from `usePermission()` in admin screens
- Before deleting an inventory item, always query active POS orders (`status` in `['pending', 'preparing', 'ready']`) to prevent breaking active carts that reference the item

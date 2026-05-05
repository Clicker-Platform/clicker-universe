# System Blocks Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move 5 misplaced block/sub-components from `components/` root into their correct locations under `components/blocks/public/`, one at a time, updating all import sites and deleting the old files after each move.

**Architecture:** Each task is fully self-contained — move one file, update all its importers, delete the old file, verify TypeScript, commit. If one task breaks something it won't affect the others. Order is chosen to handle dependencies: `LinkCard` first (used by `QuickActions`), then the four block components.

**Tech Stack:** React, Next.js App Router, TypeScript — no new deps.

---

## File Map

| Old path | New path | Type |
|----------|----------|------|
| `components/LinkCard.tsx` | `components/blocks/public/LinkCard.tsx` | Sub-component (used by QuickActions + LinkBlockClient) |
| `components/QuickActions.tsx` | `components/blocks/public/DefaultQuickActionsBlock.tsx` | System block |
| `components/OperatingHours.tsx` | `components/blocks/public/DefaultOperatingHoursBlock.tsx` | System block |
| `components/BranchesList.tsx` | `components/blocks/public/DefaultBranchesBlock.tsx` | System block |
| `components/ProductGallery.tsx` | `components/blocks/public/DefaultProductGalleryBlock.tsx` | Legacy block (PublicPageRenderer only) |

### Import sites to update per file

**LinkCard:**
- `components/blocks/public/LinkBlockClient.tsx` — import from `'./LinkCard'`
- (QuickActions will import new path — handled in Task 2)

**QuickActions:**
- `components/blocks/BlockRenderer.tsx` — dynamic import
- `components/PublicPageRenderer.tsx` — static import
- `components/blocks/mrb/MrbQuickActions.tsx` — static import

**OperatingHours:**
- `components/blocks/BlockRenderer.tsx` — dynamic import
- `components/PublicPageRenderer.tsx` — static import

**BranchesList:**
- `components/blocks/BlockRenderer.tsx` — dynamic import
- `components/PublicPageRenderer.tsx` — static import

**ProductGallery:**
- `components/PublicPageRenderer.tsx` — static import

---

## Task 1: Move `LinkCard`

`LinkCard` is a sub-component (renders one link item), not a block itself. It moves to `components/blocks/public/` because that's where its consumers live. No rename — it's not a `Default*` block.

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/LinkCard.tsx` (copy of old file)
- Modify: `clicker-platform-v2/components/blocks/public/LinkBlockClient.tsx`
- Delete: `clicker-platform-v2/components/LinkCard.tsx`

- [ ] **Step 1.1: Copy the file to new location**

```bash
cp clicker-platform-v2/components/LinkCard.tsx \
   clicker-platform-v2/components/blocks/public/LinkCard.tsx
```

- [ ] **Step 1.2: Update import in `LinkBlockClient.tsx`**

In `clicker-platform-v2/components/blocks/public/LinkBlockClient.tsx`, find:
```typescript
import { LinkCard } from '@/components/LinkCard';
```
Replace with:
```typescript
import { LinkCard } from './LinkCard';
```

- [ ] **Step 1.3: Verify no remaining imports of old path**

```bash
grep -rn "from.*@/components/LinkCard\|from.*'../LinkCard'\|from.*\"../LinkCard\"" \
  clicker-platform-v2 --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next | grep -v legacy
```

Expected: zero results.

- [ ] **Step 1.4: Delete old file**

```bash
rm clicker-platform-v2/components/LinkCard.tsx
```

- [ ] **Step 1.5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "linkcard" | head -10
```

Expected: no errors referencing LinkCard.

- [ ] **Step 1.6: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/LinkCard.tsx \
        clicker-platform-v2/components/blocks/public/LinkBlockClient.tsx \
        clicker-platform-v2/components/LinkCard.tsx
git commit -m "refactor: move LinkCard to components/blocks/public/"
```

---

## Task 2: Move `QuickActions` → `DefaultQuickActionsBlock`

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultQuickActionsBlock.tsx`
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx`
- Modify: `clicker-platform-v2/components/PublicPageRenderer.tsx`
- Modify: `clicker-platform-v2/components/blocks/mrb/MrbQuickActions.tsx`
- Delete: `clicker-platform-v2/components/QuickActions.tsx`

- [ ] **Step 2.1: Copy file and rename export**

```bash
cp clicker-platform-v2/components/QuickActions.tsx \
   clicker-platform-v2/components/blocks/public/DefaultQuickActionsBlock.tsx
```

Open `clicker-platform-v2/components/blocks/public/DefaultQuickActionsBlock.tsx` and update the `LinkCard` import (since LinkCard moved in Task 1):

Find:
```typescript
import { LinkCard } from '@/components/LinkCard';
```
Replace with:
```typescript
import { LinkCard } from './LinkCard';
```

Also add a named re-export alias so existing consumers using `{ QuickActions }` can be updated clearly:

At the bottom of the file, if the component is exported as `export const QuickActions`, add:
```typescript
export { QuickActions as DefaultQuickActionsBlock };
```

Or simply rename the export declaration from `export const QuickActions` to `export const DefaultQuickActionsBlock` and keep `export { DefaultQuickActionsBlock as QuickActions }` for the MRB template that uses it internally — whichever approach is cleaner given the actual file content. The key rule: **`BlockRenderer` must import `DefaultQuickActionsBlock` by name.**

- [ ] **Step 2.2: Update `BlockRenderer.tsx` dynamic import**

Find:
```typescript
const QuickActions = dynamic(() => import('@/components/QuickActions').then(mod => mod.QuickActions));
```
Replace with:
```typescript
const QuickActions = dynamic(() => import('./public/DefaultQuickActionsBlock').then(mod => mod.DefaultQuickActionsBlock));
```

- [ ] **Step 2.3: Update `PublicPageRenderer.tsx` static import**

Find:
```typescript
import { QuickActions } from "@/components/QuickActions";
```
Replace with:
```typescript
import { DefaultQuickActionsBlock as QuickActions } from "@/components/blocks/public/DefaultQuickActionsBlock";
```

- [ ] **Step 2.4: Update `MrbQuickActions.tsx` static import**

Find:
```typescript
import { QuickActions } from '@/components/QuickActions';
```
Replace with:
```typescript
import { DefaultQuickActionsBlock as QuickActions } from '@/components/blocks/public/DefaultQuickActionsBlock';
```

- [ ] **Step 2.5: Verify no remaining imports of old path**

```bash
grep -rn "from.*@/components/QuickActions\|from.*'../QuickActions'" \
  clicker-platform-v2 --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next | grep -v legacy
```

Expected: zero results.

- [ ] **Step 2.6: Delete old file**

```bash
rm clicker-platform-v2/components/QuickActions.tsx
```

- [ ] **Step 2.7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "quickactions" | head -10
```

Expected: no errors referencing QuickActions.

- [ ] **Step 2.8: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultQuickActionsBlock.tsx \
        clicker-platform-v2/components/blocks/BlockRenderer.tsx \
        clicker-platform-v2/components/PublicPageRenderer.tsx \
        clicker-platform-v2/components/blocks/mrb/MrbQuickActions.tsx \
        clicker-platform-v2/components/QuickActions.tsx
git commit -m "refactor: move QuickActions to DefaultQuickActionsBlock in components/blocks/public/"
```

---

## Task 3: Move `OperatingHours` → `DefaultOperatingHoursBlock`

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultOperatingHoursBlock.tsx`
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx`
- Modify: `clicker-platform-v2/components/PublicPageRenderer.tsx`
- Delete: `clicker-platform-v2/components/OperatingHours.tsx`

- [ ] **Step 3.1: Copy file to new location**

```bash
cp clicker-platform-v2/components/OperatingHours.tsx \
   clicker-platform-v2/components/blocks/public/DefaultOperatingHoursBlock.tsx
```

Check the file for any internal imports that reference `@/components/` siblings that may have moved — fix them if needed.

- [ ] **Step 3.2: Update `BlockRenderer.tsx` dynamic import**

Find:
```typescript
const OperatingHours = dynamic(() => import('@/components/OperatingHours').then(mod => mod.OperatingHours));
```
Replace with:
```typescript
const OperatingHours = dynamic(() => import('./public/DefaultOperatingHoursBlock').then(mod => mod.DefaultOperatingHoursBlock));
```

- [ ] **Step 3.3: Update `PublicPageRenderer.tsx` static import**

Find:
```typescript
import { OperatingHours } from "@/components/OperatingHours";
```
Replace with:
```typescript
import { DefaultOperatingHoursBlock as OperatingHours } from "@/components/blocks/public/DefaultOperatingHoursBlock";
```

- [ ] **Step 3.4: Check for MRB override**

```bash
grep -rn "OperatingHours" clicker-platform-v2/components/blocks/mrb/ --include="*.tsx"
```

If any MRB file imports `OperatingHours` from the old path, update it to:
```typescript
import { DefaultOperatingHoursBlock as OperatingHours } from '@/components/blocks/public/DefaultOperatingHoursBlock';
```

- [ ] **Step 3.5: Verify no remaining imports of old path**

```bash
grep -rn "from.*@/components/OperatingHours\|from.*'../OperatingHours'" \
  clicker-platform-v2 --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next | grep -v legacy
```

Expected: zero results.

- [ ] **Step 3.6: Delete old file**

```bash
rm clicker-platform-v2/components/OperatingHours.tsx
```

- [ ] **Step 3.7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "operatinghours" | head -10
```

Expected: no errors.

- [ ] **Step 3.8: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultOperatingHoursBlock.tsx \
        clicker-platform-v2/components/blocks/BlockRenderer.tsx \
        clicker-platform-v2/components/PublicPageRenderer.tsx \
        clicker-platform-v2/components/OperatingHours.tsx
git commit -m "refactor: move OperatingHours to DefaultOperatingHoursBlock in components/blocks/public/"
```

---

## Task 4: Move `BranchesList` → `DefaultBranchesBlock`

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultBranchesBlock.tsx`
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx`
- Modify: `clicker-platform-v2/components/PublicPageRenderer.tsx`
- Delete: `clicker-platform-v2/components/BranchesList.tsx`

- [ ] **Step 4.1: Copy file to new location**

```bash
cp clicker-platform-v2/components/BranchesList.tsx \
   clicker-platform-v2/components/blocks/public/DefaultBranchesBlock.tsx
```

Check the file for any internal imports referencing `@/components/` siblings that may have moved.

- [ ] **Step 4.2: Update `BlockRenderer.tsx` dynamic import**

Find:
```typescript
const BranchesList = dynamic(() => import('@/components/BranchesList').then(mod => mod.BranchesList));
```
Replace with:
```typescript
const BranchesList = dynamic(() => import('./public/DefaultBranchesBlock').then(mod => mod.DefaultBranchesBlock));
```

- [ ] **Step 4.3: Update `PublicPageRenderer.tsx` static import**

Find:
```typescript
import { BranchesList } from "@/components/BranchesList";
```
Replace with:
```typescript
import { DefaultBranchesBlock as BranchesList } from "@/components/blocks/public/DefaultBranchesBlock";
```

- [ ] **Step 4.4: Verify no remaining imports of old path**

```bash
grep -rn "from.*@/components/BranchesList\|from.*'../BranchesList'" \
  clicker-platform-v2 --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next | grep -v legacy
```

Expected: zero results.

- [ ] **Step 4.5: Delete old file**

```bash
rm clicker-platform-v2/components/BranchesList.tsx
```

- [ ] **Step 4.6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "brancheslist\|branches" | head -10
```

Expected: no errors.

- [ ] **Step 4.7: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultBranchesBlock.tsx \
        clicker-platform-v2/components/blocks/BlockRenderer.tsx \
        clicker-platform-v2/components/PublicPageRenderer.tsx \
        clicker-platform-v2/components/BranchesList.tsx
git commit -m "refactor: move BranchesList to DefaultBranchesBlock in components/blocks/public/"
```

---

## Task 5: Move `ProductGallery` → `DefaultProductGalleryBlock`

`ProductGallery` is only used in the legacy `PublicPageRenderer` (`case 'gallery'`), not in `BlockRenderer`. It is still a block component and should follow the same convention.

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultProductGalleryBlock.tsx`
- Modify: `clicker-platform-v2/components/PublicPageRenderer.tsx`
- Delete: `clicker-platform-v2/components/ProductGallery.tsx`

- [ ] **Step 5.1: Copy file to new location**

```bash
cp clicker-platform-v2/components/ProductGallery.tsx \
   clicker-platform-v2/components/blocks/public/DefaultProductGalleryBlock.tsx
```

Check the file for any internal imports referencing `@/components/` siblings that may have moved.

- [ ] **Step 5.2: Update `PublicPageRenderer.tsx` static import**

Find:
```typescript
import { ProductGallery } from "@/components/ProductGallery";
```
Replace with:
```typescript
import { DefaultProductGalleryBlock as ProductGallery } from "@/components/blocks/public/DefaultProductGalleryBlock";
```

- [ ] **Step 5.3: Verify no remaining imports of old path**

```bash
grep -rn "from.*@/components/ProductGallery\|from.*'../ProductGallery'" \
  clicker-platform-v2 --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next | grep -v legacy
```

Expected: zero results.

- [ ] **Step 5.4: Delete old file**

```bash
rm clicker-platform-v2/components/ProductGallery.tsx
```

- [ ] **Step 5.5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "productgallery" | head -10
```

Expected: no errors.

- [ ] **Step 5.6: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultProductGalleryBlock.tsx \
        clicker-platform-v2/components/PublicPageRenderer.tsx \
        clicker-platform-v2/components/ProductGallery.tsx
git commit -m "refactor: move ProductGallery to DefaultProductGalleryBlock in components/blocks/public/"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Covered |
|-------------|---------|
| Move LinkCard | Task 1 |
| Move QuickActions | Task 2 |
| Move OperatingHours | Task 3 |
| Move BranchesList | Task 4 |
| Move ProductGallery | Task 5 |
| Update all import sites per file | Each task has a per-importer step |
| Delete old file only after all imports updated | Each task: update → verify → delete |
| TypeScript check after each move | Each task has a tsc step |
| Commit after each move | Each task has a commit step |
| LinkCard moved before QuickActions (dependency order) | Task 1 before Task 2 |

**Placeholder scan:** No TBDs. Step 2.1 has a conditional note about export naming — this is intentional since the exact export style depends on the file content, which may vary. The instruction gives both options clearly.

**Type consistency:** All tasks use `as QuickActions` / `as OperatingHours` / `as BranchesList` / `as ProductGallery` aliases in the import sites that use the old name internally — this avoids touching call sites and keeps diffs minimal.

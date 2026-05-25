---
name: create_block
description: >
  Use when creating a new block type in the Clicker Platform Canvas Studio.
  Trigger on: "add a block", "new block", "create block", "build a block", "new block type",
  or any task that requires wiring up a new block from scratch in the admin editor and public site.
---

# /create_block — Add a New Block Type

> **CLAUDE.md Rule 9 (mandatory):** Before writing the renderer or the form, open at least one existing block of similar shape (e.g. `components/blocks/public/FeatureCardsBlock.tsx` for grid-of-cards blocks, `components/blocks/public/HeroBlock.tsx` for hero-style blocks) and mirror its conventions: typography (load `typography_system` skill), theme tokens, `cardStyle` usage, dv() responsive helper, no hardcoded colors. The platform's working code is the source of truth — never infer styling from spec snippets.
>
> **MOBILE + TABLET + DESKTOP PARITY IS NON-NEGOTIABLE.** Every block MUST be fully operable on mobile (≤640px), tablet (641–1024px), AND desktop. No "we'll polish mobile later." No "this block is desktop-only." Tablet is part of the mobility story (operators use iPads at the counter) — never collapse it into "just a smaller desktop." If you can't show the block working at 360px, 768px, AND ≥1024px, you're not done. See [Section 8: Responsive Layout](#8-responsive-layout-mandatory) — required before claiming any block complete.

Blocks are stored as `PageBlock` JSON in Firestore and rendered in two places: the admin Canvas Studio editor and the public site. Every new block requires **7 touch points**, in this order.

---

## 1. Add the type to `BlockType`

**File:** `clicker-platform-v2/data/mockData.ts` — line ~30

```ts
export type BlockType =
  | 'hero' | 'text' | 'image' | ... | 'your_block' | string;
```

---

## 2. Register in `BLOCK_OPTIONS` + `getDefaultData`

**File:** `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts`

```ts
// BLOCK_OPTIONS — shown in the "Add Block" sidebar panel
{ type: 'your_block', label: 'Your Block', icon: SomeLucideIcon },

// getDefaultData — initial data when block is first added
case 'your_block':
    return { ...baseData, title: 'Default Title', someField: '' };
```

---

## 3. Create the admin form

**File:** `clicker-platform-v2/components/admin/blocks/forms/YourBlockForm.tsx`

```tsx
'use client';

interface Props {
    data: any;
    onChange: (data: any) => void;
}

export function YourBlockForm({ data, onChange }: Props) {
    const safe = data || {};
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
                    Title
                </label>
                <input
                    type="text"
                    value={safe.title || ''}
                    onChange={(e) => onChange({ ...safe, title: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm focus:border-blue-500/50 focus:outline-none"
                />
            </div>
        </div>
    );
}
```

Use `MediaField` for image/video inputs (see `ImageForm.tsx`). Use `RichTextEditor` (dynamic import) for rich text.

---

## 4. Register form in `BlockFormRenderer`

**File:** `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx`

```tsx
// 1. Add dynamic import at top
const YourBlockForm = dynamic(
    () => import('./forms/YourBlockForm').then(mod => mod.YourBlockForm),
    { loading: () => <FormSkeleton /> }
);

// 2. Add to the coreLabels lookup (inside useEffect)
'your_block': 'Your Block',

// 3. Add switch case
case 'your_block':
    return renderWithLayoutPicker(<YourBlockForm data={block.data} onChange={handleDataChange} />);
    // Skip renderWithLayoutPicker if the block has no layout variants
```

---

## 5. Create the public renderer

**File:** `clicker-platform-v2/components/blocks/public/DefaultYourBlock.tsx`

```tsx
'use client';

export const DefaultYourBlock = ({ data }: { data: any }) => {
    if (!data?.title) return null;
    return (
        <section className="w-full px-4 py-6 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-[var(--theme-foreground)]">
                {data.title}
            </h2>
        </section>
    );
};
```

Use `var(--theme-*)` CSS variables for colours so the block respects templates.

### LCP rule — blocks that render images

If your block renders a `<Image>` (next/image) or a `<img>` tag, it **must** accept an `isFirst` prop and use it to gate `priority` and `fetchPriority`. This ensures the LCP element gets a preload hint injected in `<head>` without also preloading images that are below the fold.

```tsx
'use client';

import Image from 'next/image';

export const DefaultYourBlock = ({ data, isFirst = false }: { data: any; isFirst?: boolean }) => {
    if (!data?.imageUrl) return null;
    return (
        <section className="w-full px-4 py-6 max-w-5xl mx-auto">
            <Image
                src={data.imageUrl}
                alt={data.alt || ''}
                width={1200}
                height={800}
                sizes="(max-width: 1024px) 100vw, 1200px"
                priority={isFirst}
                fetchPriority={isFirst ? 'high' : 'auto'}
                className="w-full h-auto object-cover"
            />
        </section>
    );
};
```

If your block uses `MediaView`, pass the prop through:

```tsx
<MediaView media={data.media} priority={isFirst} />
```

Blocks with **no images** (text, buttons, maps, iframes) can omit `isFirst` entirely.

---

## 6. Register in `BlockRenderer`

**File:** `clicker-platform-v2/components/blocks/BlockRenderer.tsx`

```tsx
// 1. Add dynamic import
const YourBlock = dynamic(
    () => import('./public/DefaultYourBlock').then(mod => mod.DefaultYourBlock)
);

// 2. Add switch case inside renderBlock()
// If the block renders images, forward isFirst so the LCP element gets priority:
case 'your_block':
    return customBlocks?.YourBlock
        ? React.createElement(customBlocks.YourBlock, { data: block.data, isFirst })
        : <YourBlock data={block.data} isFirst={isFirst} />;

// If the block never renders images (text, button, map, iframe), omit isFirst:
case 'your_block':
    return customBlocks?.YourBlock
        ? React.createElement(customBlocks.YourBlock, { data: block.data })
        : <YourBlock data={block.data} />;
```

Static imports (no `dynamic`) are reserved for LCP-critical above-the-fold blocks like `hero` and `image_gallery`.

---

## 7. (Optional) Extract a types file

For blocks with complex data, create:

**File:** `clicker-platform-v2/components/blocks/your-block/types.ts`

Export interfaces, constants, and a `DEFAULT_*` object. Import from both the form and public renderer (see `content-showcase/types.ts` as a reference).

---

## 8. Responsive Layout (MANDATORY)

**Every block MUST work on mobile (≤640px) AND desktop.** No exceptions. The platform's value prop is that operators run their business on a phone — a block that's "desktop only" or "we'll fix mobile later" is broken and cannot ship.

### The two-environment problem

Blocks render in two places that interpret breakpoints differently:

| Environment | How Tailwind breakpoints behave |
| --- | --- |
| **Public site** (real browser) | `sm:` `md:` `lg:` fire on real viewport width. Works as normal. |
| **Canvas Studio preview** (mobile/tablet/desktop frame) | `sm:` `md:` `lg:` fire on the **outer browser viewport**, NOT the preview frame. A `md:flex-row` set on a block inside the 375px mobile preview will still apply because the editor browser is 1440px wide. |

So `sm:hidden` on a "mobile scroller" wrapper hides it in Canvas mobile preview (because the outer viewport is desktop), even though it works correctly on a real phone. This is the trap that wastes the most time.

### Canonical pattern: production + Canvas-aware branching

For any block with **different layouts per breakpoint** (column count, scroll vs stack, flex direction, hidden elements), use this template:

```tsx
'use client';
import { useDeviceView } from '@/components/DeviceViewContext';

export default function MyBlock({ data }: Props) {
  const deviceView = useDeviceView();
  // ... data fetching ...

  const mobileLayout = <div className="flex overflow-x-auto snap-x ...">{/* scroller */}</div>;
  const desktopLayout = <div className="grid grid-cols-3 gap-4">{/* grid */}</div>;

  return (
    <section className="py-12">
      {deviceView === 'mobile' ? mobileLayout :
       deviceView === 'tablet' || deviceView === 'desktop' ? desktopLayout :
       (
         // 'responsive' = public site, let real viewport decide via Tailwind
         <>
           <div className="sm:hidden">{mobileLayout}</div>
           <div className="hidden sm:block">{desktopLayout}</div>
         </>
       )}
    </section>
  );
}
```

`useDeviceView()` returns `'mobile' | 'tablet' | 'desktop' | 'responsive'`. On the public site there's no `DeviceViewProvider`, so it defaults to `'responsive'` → Tailwind classes run normally. In Canvas it returns the selected preview device → render that branch directly, bypassing breakpoint utilities.

### Simpler `dv()` helper for class-only swaps

When you're only swapping classes (not whole subtrees), use `dv()` from the same file. Example from `DefaultHeroBlock.tsx`:

```tsx
const headingClass = dv(deviceView, 'text-3xl', 'md:text-4xl');
// responsive: "text-3xl md:text-4xl"  (Tailwind decides)
// mobile:     "text-3xl"
// desktop:    "text-3xl md:text-4xl"  (md: fires on real desktop)
```

Use `dv()` for typography, padding, gap; use the branching template above for structural differences (grid vs flex, hidden subtrees).

### Anti-patterns

| Don't | Why |
| --- | --- |
| `sm:hidden` / `hidden sm:block` alone (no `deviceView` branch) | Canvas mobile preview hides the mobile branch because outer viewport is desktop. |
| `useDeviceView()` only, no `'responsive'` fallback | Public site never gets a layout — `deviceView` is `'responsive'` and you forgot that branch. |
| `md:flex-row` on narrow Canvas column block | Fires on real desktop even inside a 320px Canvas column. Wrap with `dv()`. |
| Skipping mobile or tablet because "user will only use this on desktop" | The platform is built for operators running their business on phones AND tablets. Build mobile-first, then verify tablet, then desktop. |

### Verification before claiming done

1. **Local dev → Chrome DevTools mobile (360px)** — the golden path must work end-to-end.
2. **Local dev → Chrome DevTools desktop** — must also work.
3. **Canvas Studio → toggle mobile / tablet / desktop preview** — all three must render correctly.
4. **If layout differs across breakpoints, you used the canonical template above.** If you wrote only `sm:hidden` and called it done, you didn't verify Canvas.

If you cannot show the block working on a 360px viewport, the block is incomplete. Do not register, commit, or report success.

---

## Checklist

- [ ] `BlockType` union updated in `mockData.ts`
- [ ] `BLOCK_OPTIONS` entry added in `blockDefinitions.ts`
- [ ] `getDefaultData` case added in `blockDefinitions.ts`
- [ ] Admin form created at `forms/YourBlockForm.tsx`
- [ ] Form registered in `BlockFormRenderer.tsx` (dynamic import + coreLabels + switch case)
- [ ] Public renderer created at `public/DefaultYourBlock.tsx`
- [ ] **If block renders images:** accepts `isFirst?: boolean`, gates `priority`/`fetchPriority` on it
- [ ] Public renderer registered in `BlockRenderer.tsx` (dynamic import + switch case)
- [ ] **If block renders images:** `isFirst` forwarded in the `BlockRenderer` switch case
- [ ] Types file created if data shape is non-trivial

---

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Forgot `coreLabels` entry in `BlockFormRenderer` | Without it, the editor treats the block as a module block and shows the module fallback UI |
| Used `static import` for public renderer | Only hero/image_gallery are static; all others must be `dynamic()` to keep bundle size small |
| Hardcoded colours in public renderer | Use `var(--theme-primary)`, `var(--theme-foreground)` etc. so templates can override |
| No `customBlocks?.YourBlock` branch in `BlockRenderer` | Template-specific overrides won't work; always include the ternary |
| Missing `'use client'` on form or public renderer | Both are client components; they need the directive |
| Block renders images but ignores `isFirst` | LCP image won't be preloaded; page will score poorly on Core Web Vitals. Accept `isFirst?: boolean` and gate `priority`/`fetchPriority` on it |
| Forgot to forward `isFirst` in `BlockRenderer` switch case | The prop never reaches the block component, so the LCP fix is silently broken |

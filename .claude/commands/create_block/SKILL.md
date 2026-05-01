---
name: create_block
description: >
  Use when creating a new block type in the Clicker Platform Canvas Studio.
  Trigger on: "add a block", "new block", "create block", "build a block", "new block type",
  or any task that requires wiring up a new block from scratch in the admin editor and public site.
---

# /create_block — Add a New Block Type

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

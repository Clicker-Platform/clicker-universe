---
name: block_standards
description: >
  Enforce platform-wide conventions every public block must follow: standard data fields
  (verticalSpacing, horizontalPadding, mobileLayout, columns), canonical spacing constants,
  and the Canvas-preview-aware responsive pattern. Use this skill whenever creating OR
  editing any file in components/blocks/public/ or components/blocks/mrb/, when reviewing
  blocks for consistency, or when fixing layout/spacing/responsiveness bugs in a block.
  Trigger on: "block padding", "vertical spacing", "horizontal scroll on mobile",
  "block looks wrong on mobile", "block too tall", "py-12", "mobileLayout",
  "verticalSpacing", or any work in components/blocks/public/ or components/blocks/mrb/.
---

# /block_standards — Block Conventions Every Public Block Must Follow

> **Scope:** This skill governs the *conventions inside* a block (data fields, spacing, responsiveness). For scaffolding a brand-new block type (the 7 touch points: BlockType, BLOCK_OPTIONS, form, BlockFormRenderer, public renderer, BlockRenderer, types), load `/create_block` as well. For typography rules inside a block, load `/typography_system`.

These rules apply to **every** public block, whether you're creating one or editing one. If you touch a file under `components/blocks/public/` or `components/blocks/mrb/`, this skill governs the change.

---

## 1. Standard Data Fields Every Block Should Expose

Don't bake layout assumptions into the renderer. Expose them as data fields so the tenant can tune the block from the editor without touching code.

| Field | Type | Default | When to include |
| --- | --- | --- | --- |
| `verticalSpacing` | `'none' \| 'small' \| 'medium' \| 'tall'` | `'medium'` | **Always**, if the block has any top/bottom section padding. |
| `horizontalPadding` | `'none' \| 'normal' \| 'wide'` | `'none'` | When the block content benefits from gutter control (text, prose). |
| `mobileLayout` | `'stack' \| 'scroll'` | `'stack'` | Multi-item blocks (grids, lists, carousels) where mobile may prefer horizontal swipe. |
| `columns` | `1 \| 2 \| 3 \| 4` | `3` | Grid/card blocks. `1` is a valid layout — include it. |

**Anti-pattern:** hardcoding `py-12` or `py-16` on the `<section>` and shipping. If the block has top/bottom padding at all, it MUST be tenant-controllable via `verticalSpacing`. Default `py-12` is almost always too tall — the tenant has to ask you to make it smaller, which is exactly what this rule prevents.

---

## 2. Canonical Constants (copy verbatim, do not invent)

```tsx
const VERTICAL_SPACING = {
    none:   'py-0',
    small:  'py-4',
    medium: 'py-8',
    tall:   'py-14',
} as const;

const HORIZONTAL_PADDING = {
    none:   'px-0',
    normal: 'px-4',
    wide:   'px-8',
} as const;
```

Reference implementations:
- [`DefaultTextBlock.tsx`](../../../clicker-platform-v2/components/blocks/public/DefaultTextBlock.tsx) — both fields
- [`DefaultHeadingBlock.tsx`](../../../clicker-platform-v2/components/blocks/public/DefaultHeadingBlock.tsx) — `verticalSpacing` only
- [`ProductGridBlock.tsx`](../../../clicker-platform-v2/components/blocks/public/ProductGridBlock.tsx) — `verticalSpacing` + `mobileLayout` + `columns`

The matching button-toggle form UI is in [`TextForm.tsx`](../../../clicker-platform-v2/components/admin/blocks/forms/TextForm.tsx). **Copy that markup, don't invent your own.**

### Renderer pattern

```tsx
const verticalClass = VERTICAL_SPACING[(data.verticalSpacing || 'medium') as keyof typeof VERTICAL_SPACING] ?? 'py-8';

return <section className={verticalClass}>{...}</section>;
```

### Form pattern

```tsx
<div>
  <label className={labelClass}>Vertical Spacing</label>
  <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
    {(['none', 'small', 'medium', 'tall'] as const).map((v) => (
      <button
        key={v}
        type="button"
        onClick={() => set('verticalSpacing', v)}
        className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
          (safe.verticalSpacing || 'medium') === v
            ? 'bg-blue-600 text-white shadow'
            : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
        }`}
      >
        {v === 'none' ? 'None' : v === 'small' ? 'Small' : v === 'medium' ? 'Medium' : 'Tall'}
      </button>
    ))}
  </div>
</div>
```

---

## 3. Responsive Layouts — Canvas-Preview-Aware Pattern (MANDATORY)

> **Mobile + tablet + desktop parity is non-negotiable.** Every block MUST work at 360px, 768px, AND ≥1024px. Tablet is part of the mobility story (operators use iPads at the counter); never collapse it into "smaller desktop."

### The two-environment problem

| Environment | How Tailwind breakpoints behave |
| --- | --- |
| **Public site** (real browser) | `sm:` `md:` `lg:` fire on real viewport width. Works as normal. |
| **Canvas Studio preview** (mobile/tablet/desktop frame) | `sm:` `md:` `lg:` fire on the **outer browser viewport**, NOT the preview frame. A `sm:hidden` set on a "mobile" element inside the 375px mobile preview will still hide it because the editor browser is 1440px wide. |

So `sm:hidden` alone is broken in Canvas mobile preview. Conversely, `useDeviceView()` alone is broken on the public site (where `deviceView === 'responsive'`).

### Canonical pattern

For any block with **different layouts per breakpoint** (column count, scroll vs stack, flex direction, hidden subtrees), use this template. **Every variant — including the "default" mobile layout — must route through `deviceView`, not just the optional one.**

```tsx
'use client';
import { useDeviceView } from '@/components/DeviceViewContext';

export default function MyBlock({ data }: Props) {
  const deviceView = useDeviceView();
  // ... data fetching ...

  const mobileVariantA = <div className="...">{/* stacked layout */}</div>;
  const mobileVariantB = <div className="flex overflow-x-auto snap-x ...">{/* scroller */}</div>;
  const desktopLayout = <div className="grid grid-cols-3 gap-4">{/* grid */}</div>;

  const mobileView = data.mobileLayout === 'scroll' ? mobileVariantB : mobileVariantA;

  if (deviceView === 'mobile') return mobileView;
  if (deviceView === 'tablet' || deviceView === 'desktop') return desktopLayout;
  // 'responsive' = public site — let real viewport decide via Tailwind
  return (
    <>
      <div className="sm:hidden">{mobileView}</div>
      <div className="hidden sm:block">{desktopLayout}</div>
    </>
  );
}
```

`useDeviceView()` returns `'mobile' | 'tablet' | 'desktop' | 'responsive'`. On the public site there's no `DeviceViewProvider`, so it defaults to `'responsive'` → Tailwind classes run normally. In Canvas it returns the selected preview device → render that branch directly.

### When to use `dv()` instead of branching

If you're only swapping classes (typography, padding, gap), use the `dv()` helper from `DeviceViewContext`:

```tsx
const headingClass = dv(deviceView, 'text-3xl', 'md:text-4xl');
// responsive: "text-3xl md:text-4xl"  (Tailwind decides)
// mobile:     "text-3xl"
// desktop:    "text-3xl md:text-4xl"
```

Use `dv()` for class-only swaps; use the branching template above for structural differences.

### Anti-patterns

| Don't | Why |
| --- | --- |
| `sm:hidden` / `hidden sm:block` alone (no `deviceView` branch) | Canvas mobile preview hides the mobile branch because outer viewport is desktop. |
| `useDeviceView()` only, no `'responsive'` fallback | Public site never gets a layout — `deviceView` is `'responsive'` and you forgot that branch. |
| Routing only ONE variant of `mobileLayout` through `deviceView` | If `scroll` mode is Canvas-aware but `stack` mode isn't, switching to `stack` breaks Canvas preview. Route ALL variants through the same switch. |
| `md:flex-row` inside a narrow block | Fires on real desktop even inside a 320px container. Wrap with `dv()` or use container queries. |
| Skipping mobile or tablet because "user will only use this on desktop" | The platform is built for operators running their business on phones AND tablets. Build mobile-first, then verify tablet, then desktop. |

---

## 4. Verification Before Claiming Done

If the block has different layouts across breakpoints, you MUST verify:

1. **Local dev → Chrome DevTools at 360px** — golden path works.
2. **Local dev → Chrome DevTools at 768px** — tablet layout works.
3. **Local dev → Chrome DevTools at ≥1024px** — desktop layout works.
4. **Canvas Studio → toggle mobile / tablet / desktop preview** — all three render correctly.
5. **Every `mobileLayout` variant verified in Canvas mobile preview.** Not just the default.

If you cannot show the block working on all three viewport sizes AND all `mobileLayout` variants in Canvas, the block is incomplete. Do not commit or report success.

---

## 5. Quick Checklist

- [ ] `verticalSpacing` field exposed in types, form, renderer (default `'medium'`)
- [ ] `horizontalPadding` field exposed if block content benefits from gutter control
- [ ] `mobileLayout` field exposed if block is multi-item and could benefit from horizontal scroll
- [ ] `columns` field includes `1` as an option (single-column is a valid layout)
- [ ] All canonical constants copied verbatim (no custom `py-12`, `py-16`, etc.)
- [ ] Form uses the button-toggle UI pattern from `TextForm.tsx`
- [ ] If block layout differs across breakpoints: routed through `useDeviceView()` with `'responsive'` fallback
- [ ] Verified at 360px, 768px, ≥1024px (real browser) AND in Canvas mobile/tablet/desktop preview
- [ ] Every `mobileLayout` variant tested in Canvas mobile preview (not just default)

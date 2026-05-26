# Canvas Preview → Real Iframe Migration (Deferred)

**Date noted:** 2026-05-25
**Status:** Deferred — workaround in place via `block_standards` skill + `useDeviceView()`
**Estimated effort:** 1–2 days

## The Problem

Canvas Studio's mobile/tablet/desktop preview renders blocks inside a fixed-width container, but the **outer browser viewport** is still desktop-width (e.g., 1440px). Tailwind responsive utilities (`sm:`, `md:`, `lg:`) key off the real viewport, not the preview container — so:

- `sm:hidden` on a "mobile-only" element evaluates as `true` in Canvas mobile preview because the real viewport is ≥640px → element is hidden when it should be visible.
- `md:flex-row` fires on a block inside a 320px Canvas column because real viewport is ≥768px.

We've hit this bug repeatedly (Hero, ProductGrid, others) and worked around it with `useDeviceView()` + a `'responsive'` fallback branch. The workaround is documented in the `block_standards` skill, but every new block author has to remember it and write the boilerplate.

## The Real Fix

Replace the current preview container with a true `<iframe>` whose `src` is the preview URL and whose `width` matches the selected device (360 / 768 / desktop). The iframe's document then has its actual width = preview width, so `sm:` / `md:` / `lg:` fire on the iframe's own viewport.

**Benefits:**
- `sm:hidden` and friends Just Work. No more `useDeviceView()` branching for breakpoint-driven layout.
- `block_standards` Section 3 (the Canvas-aware pattern) becomes unnecessary boilerplate.
- New block authors can write standard Tailwind responsive code and be confident Canvas preview matches production.
- Container queries also work naturally (currently they don't because the "container" isn't a real layout container).

**Tradeoffs:**
- Iframes need to load the full page (or a stripped variant) — slower than the current inline render.
- Editor → preview communication (selection, hover, scroll position) needs `postMessage` instead of shared React state.
- Hot reload becomes per-iframe instead of shared component re-render.
- Some shared state (theme tokens, fonts, site context) needs to be re-injected per iframe load.

## Where to Start

- Editor harness: `clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx` (line ~279, `DeviceViewProvider` mount point — this would become an `<iframe>` instead).
- Preview document: would need a new route like `/admin/canvas-preview/[pageId]` that renders blocks in isolation with theme/site context, served at the iframe's `src`.
- Selection sync: today via `EditorContext.selection`; would migrate to `window.postMessage` between editor and iframe.
- Block click handlers in the iframe call `parent.postMessage(...)` instead of context setters.

## Why Deferred

- Current workaround (`useDeviceView()` + skill) is functional; no user-facing bug.
- 1–2 day rewrite touches CanvasStudio + every block (to drop `dv()` calls afterwards, or leave them as no-ops).
- Bigger leverage projects ahead (Digital Goods Plan 2, AI Boosters, etc.).
- Revisit when: (a) a new responsive pattern breaks the workaround, or (b) we onboard external contributors who'd find `useDeviceView()` boilerplate confusing.

## Related

- Skill: `.claude/commands/block_standards/SKILL.md`
- Helper: `clicker-platform-v2/components/DeviceViewContext.tsx`
- Memory: `feedback_canvas_preview_md_breakpoint.md`, `feedback_use_standard_responsive_patterns.md`

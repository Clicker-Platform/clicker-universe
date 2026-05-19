# Multi-Layer Gradient System — Design Spec

**Date:** 2026-05-16
**Status:** Design approved, ready for plan
**Scope:** Add multi-layer radial gradient support to the Clicker Platform as a reusable visual asset, authored inside Canvas Studio.

---

## 1. Goal

Let designers compose multi-layer radial gradients ("mesh"/blob gradients) and apply them as page backgrounds — globally or per page. Gradients are **reusable site-scoped assets**, not per-page configurations. Edit once, applied everywhere it's referenced.

The system is built to be **medium-agnostic** at the data and renderer layer (any element can consume a gradient), but the v1 **author/apply surface is limited to page backgrounds**.

---

## 2. Non-Goals (v1)

- Block-level gradient backgrounds (Hero, Columns, etc.) — those blocks don't yet expose `background` fields. Out of scope.
- Gradient fills on buttons, cards, badges, or text — requires template-token work. Out of scope.
- Linear/conic gradients — radial only in v1.
- AI-suggested gradient palettes — out of scope.
- Animated gradients — static only.
- Public/SSR pre-resolution of gradients — v1 client-fetches like other site assets.

---

## 3. Data Model

### `GradientLayer`

```ts
export interface GradientLayer {
  id: string;                                                 // stable per layer
  color: string;                                              // hex, e.g. "#fbbf24"
  x: number;                                                  // 0–100 (% from left)
  y: number;                                                  // 0–100 (% from top)
  size: number;                                               // 0–200 (% of canvas)
  shape: 'circle' | 'ellipse';
  opacity: number;                                            // 0–1
  blendMode: 'normal' | 'screen' | 'multiply' | 'overlay';
}
```

### `SavedGradient`

```ts
export interface SavedGradient {
  id: string;
  name: string;                                               // "Sunset Glow"
  baseColor: string;                                          // hex — canvas behind the layers
  layers: GradientLayer[];                                    // visual stacking order: index 0 = frontmost
  createdAt: any;                                             // Firestore Timestamp
  updatedAt: any;
}
```

### Extension to `BackgroundMediaBase`

In `data/mockData.ts`:

```ts
export interface BackgroundMediaBase {
  mode: 'inherit' | 'color' | 'image' | 'video' | 'gradient'; // ← new value
  url?: string;
  color?: string;
  displaySize?: 'cover' | 'contain' | 'pattern';
  backgroundPosition?: string;
  scrollEffect?: 'scroll' | 'fixed';
  overlayColor?: string;
  overlayOpacity?: number;
  gradientId?: string;                                        // ← required when mode === 'gradient'
}
```

`BackgroundMedia.mobile?: BackgroundMediaBase` continues to work unchanged — a mobile override can reference a *different* `gradientId`, allowing device-specific gradients without complicating the gradient model itself.

### Storage

- `sites/{siteId}/gradients/{gradientId}` — siteId-scoped, follows existing multi-tenant pattern.
- Reference pattern: consumers store `{ mode: 'gradient', gradientId }` — never the full gradient. Edit propagates automatically.

### Migration

No migration needed. Existing `BackgroundMedia` records with `mode: 'color' | 'image' | 'video' | 'inherit'` are untouched. The new `'gradient'` mode is purely additive.

---

## 4. CSS Output

The renderer is pure CSS — no SVG, no canvas, no JS at render time.

### `gradientToCss` helper

```ts
// lib/gradients/toCss.ts
export function gradientToCss(g: SavedGradient): {
  backgroundColor: string;
  backgroundImage: string;
  backgroundBlendMode: string;
} {
  const visible = g.layers.filter(l => l.opacity > 0);

  const backgroundImage = visible
    .map(l => {
      const shape = l.shape === 'circle' ? 'circle' : 'ellipse';
      const color = withAlpha(l.color, l.opacity); // hex → rgba
      return `radial-gradient(${shape} ${l.size}% at ${l.x}% ${l.y}%, ${color} 0%, transparent 70%)`;
    })
    .join(', ');

  const backgroundBlendMode = visible.map(l => l.blendMode).join(', ');

  return {
    backgroundColor: g.baseColor,
    backgroundImage,
    backgroundBlendMode,
  };
}
```

**CSS stacking rule:** in `background-image`, the first declaration paints on top. `layers[0]` = frontmost (matches the layer list order in the Studio top-to-bottom).

**Opacity:** baked into the color (rgba) rather than via a separate `opacity` CSS property, so each layer's transparency is independent.

**Blend modes:** applied via `background-blend-mode` — one entry per layer, comma-separated. Browser handles compositing on GPU.

---

## 5. File Layout

```
clicker-platform-v2/
├── lib/gradients/
│   ├── types.ts                          # GradientLayer, SavedGradient
│   ├── constants.ts                      # DB path: sites/{siteId}/gradients
│   ├── api.ts                            # CRUD: getGradients, getGradient,
│   │                                     #       saveGradient, deleteGradient,
│   │                                     #       subscribeToGradients
│   ├── color.ts                          # withAlpha(hex, opacity) → rgba string
│   └── toCss.ts                          # gradientToCss(g) helper
│
├── components/admin/canvas-studio/gradients/
│   ├── GradientStudioMode.tsx            # Top-level mode component
│   ├── GradientList.tsx                  # Left rail: saved gradients
│   ├── GradientPreview.tsx               # Center: live canvas + draggable handles
│   ├── GradientLayerList.tsx             # Right rail: layer list
│   ├── GradientLayerControls.tsx         # Right rail: selected layer sliders/pickers
│   └── ApplyToPicker.tsx                 # Top-bar "Apply to…" dropdown
│
├── components/admin/blocks/
│   ├── CanvasStudio.tsx                  # MODIFIED: add mode toggle
│   │                                     # [Page Editor] [Gradients]
│   └── BackgroundMediaEditor.tsx         # MODIFIED:
│                                         #   - add 'gradient' to mode select
│                                         #   - render SavedGradientPicker when chosen
│                                         #   - "+ Create new" switches CS mode
│
├── components/blocks/
│   └── PageBackground.tsx                # MODIFIED: handle mode === 'gradient'
│
└── data/mockData.ts                      # MODIFIED: extend BackgroundMediaBase
```

### Boundary rules

- `lib/gradients/` has **no React, no admin dependencies**. Pure types, Firestore I/O, and the `toCss` helper. Any consumer (block, page, future button) imports from here.
- `components/admin/canvas-studio/gradients/` is editor-only. Importable only from Canvas Studio internals.
- `PageBackground.tsx` consumes via `gradientToCss` — same as any future consumer would.

---

## 6. Canvas Studio Integration

Gradient editing happens inside Canvas Studio as a **mode**, not a side panel — the canvas needs full page-width to be representative.

### Mode toggle (top bar of Canvas Studio)

```
[Page Editor] [Gradients]
```

- **Page Editor mode** — existing behavior (block canvas + side panels).
- **Gradients mode** — replaces the canvas content and side panels with gradient UI.
- Switching modes preserves state; toggling back doesn't lose unsaved gradient changes.

### Gradients mode layout

```
┌─ Canvas Studio top bar ──────────────────────────────────────┐
│ [Page Editor] [Gradients ◀]   Apply to… ▾   Save             │
├──────────┬──────────────────────────────────┬────────────────┤
│ Saved    │  Live preview canvas             │ Base color     │
│ Gradients│  (page-width, same as Canvas     │                │
│ (list)   │   Studio's normal preview)       │ Layers (list)  │
│ + New    │  Draggable handles per layer     │ + Add          │
│          │  Desktop / Mobile preview toggle │                │
│          │                                  │ Selected layer │
│          │                                  │   controls     │
└──────────┴──────────────────────────────────┴────────────────┘
```

The center preview matches the active **device preview** of Canvas Studio (Desktop/Mobile) so the designer composes at true target dimensions.

### Entry points

1. **Mode toggle** in Canvas Studio top bar — always available.
2. **From Page Background panel** — when user picks `Background Type → Saved Gradient`, the picker lists existing gradients + a **"+ Create new gradient"** entry. Clicking the latter switches Canvas Studio to Gradients mode with a new blank gradient pre-created and selected.

---

## 7. Gradient Studio Interactions

### Saved gradients list (left rail)

- Vertical list of thumbnails (32×32) + name.
- Click → loads that gradient into the editor. If current gradient has unsaved changes, debounced auto-save flushes first.
- Hover → reveals duplicate / delete icons (no permanent button clutter).
- **+ New Gradient** — creates a new doc with one default layer, name "Untitled", makes it the active selection.
- Selected gradient has highlighted border.

### Preview canvas (center)

- Aspect ratio follows Canvas Studio's active device preview (Desktop = ~16:9, Mobile = ~9:16).
- **Draggable handles**, one per visible layer. Drag updates that layer's `x`/`y` live.
- Click handle → selects that layer (right rail updates).
- Click empty canvas area → deselects (controls collapse to a "select a layer" hint).
- **Resize handle on selected layer** — deferred. Start with size slider in right rail; revisit after dogfood.

### Layer list (right rail, top)

- Drag-handle (⋮⋮) reorders. **First in list = frontmost visually.**
- Eye icon toggles visibility (sets `opacity: 0` without deleting — quick A/B compare).
- Click a row → selects that layer.
- **+ Add** appends a new layer: random pastel color, centered (50/50), 50% size, circle, opacity 1, normal blend.

### Selected layer controls (right rail, bottom)

- **Color** — reuse the existing platform color picker (the one used in theme editor).
- **Size** — slider, 0–200% (label as %).
- **Opacity** — slider, 0–100% (stored 0–1).
- **Shape** — segmented control: Circle / Ellipse.
- **Blend** — dropdown: Normal / Screen / Multiply / Overlay.

All controls are **live** — drag = instant preview update. No commit step.

### Save behavior

- **Auto-save** on blur of any control, debounced 500ms.
- Top-bar **Save** is a no-op when clean. Shows a dirty indicator + tooltip "Saving…" while pending.
- **Name** is editable inline in the top-bar breadcrumb (`/ Sunset Glow`). Blur = commits to `name` field.

### Apply to… dropdown (top bar)

v1 targets:

1. **Global Background** — writes `sites/{siteId}.globalBackground = { mode: 'gradient', gradientId }`.
2. **Page: [page picker]** — opens a small picker of pages, writes `pages/{pageId}.background = { mode: 'gradient', gradientId }`.

Behavior:
- Apply is **one-shot** — does not change what's being edited.
- Shows a toast: `"Sunset Glow applied to Global Background"` (or page name).
- Future v2 may add: block-level fields, button fills, etc. — via a registry pattern. Not v1.

### Mobile preview

- The preview canvas respects Canvas Studio's existing device toggle.
- A `SavedGradient` is **device-agnostic** — there is no mobile variant inside the gradient itself.
- Device-specific gradients are handled at the **consumer** level: `BackgroundMedia.mobile.gradientId` references a separate `SavedGradient`. Composed in the Page Background panel, not in the Studio.

---

## 8. Renderer Integration

### `PageBackground.tsx` change

Add one branch to `BackgroundLayer`:

```tsx
if (mode === 'gradient' && cfg.gradientId) {
  const gradient = useResolvedGradient(cfg.gradientId);
  if (!gradient) return null;
  const { backgroundColor, backgroundImage, backgroundBlendMode } = gradientToCss(gradient);
  return (
    <div className={`${positionClass} inset-0 pointer-events-none ${visibilityClass}`}
         style={{
           zIndex: -15,
           backgroundColor,
           backgroundImage,
           backgroundBlendMode,
         }} />
  );
}
```

### `useResolvedGradient(id)` hook

- Lives in `lib/gradients/api.ts` (the hook re-exported from a client entry).
- In-memory cache keyed by `${siteId}/${gradientId}` to dedupe across components on the same page.
- Subscribes to the Firestore doc for live updates so Studio edits reflect on already-loaded preview pages.
- Returns `SavedGradient | null` (null while loading or if doc doesn't exist).

### Existing overlay support

The existing `overlayColor` / `overlayOpacity` fields still apply when `mode === 'gradient'` — a single solid overlay can sit on top of the gradient layer (useful for darkening). Implementation: keep the existing overlay div rendering logic; it runs after the gradient layer.

---

## 9. RBAC & Multi-Tenancy

- All Firestore writes (`saveGradient`, `deleteGradient`) check `canEdit()` per platform convention.
- All paths are siteId-scoped via `useSite()` — no hardcoded tenants.
- DB path lives in `lib/gradients/constants.ts` per project rule #5.
- Apply-to-Page targets restricted to pages in the current site.

---

## 10. Testing Strategy

- **`gradientToCss` unit tests** — given fixtures, snapshot the produced CSS string. Covers layer ordering, opacity → rgba, blend mode joining, empty-layers case.
- **Component tests** — `GradientPreview` handle-drag updates layer x/y; `GradientLayerList` reorder updates array order; `GradientLayerControls` slider changes propagate.
- **Renderer integration test** — `PageBackground` with `mode: 'gradient'` resolves the gradient and applies expected styles.
- **No e2e in v1** — manual QA in Canvas Studio is sufficient for the editor flow.

---

## 11. Open Questions

None. All decisions are settled.

---

## 12. Rough Effort Estimate

| Phase | Hours |
|---|---|
| Data layer (`lib/gradients/*`) + `toCss` + tests | 1.5 |
| Renderer integration (`PageBackground.tsx`) + `useResolvedGradient` hook | 1.5 |
| Canvas Studio mode toggle infrastructure | 1.5 |
| Gradient Studio UI — preview + handles | 3 |
| Gradient Studio UI — layer list + controls + auto-save | 2.5 |
| `BackgroundMediaEditor` integration + SavedGradientPicker | 1.5 |
| Apply-to-… dropdown + page picker | 1 |
| Polish, QA, edge cases | 1.5 |
| **Total** | **~14h** |

---

## 13. References

- Existing renderer: [components/blocks/PageBackground.tsx](../../clicker-platform-v2/components/blocks/PageBackground.tsx)
- Existing editor: [components/admin/blocks/BackgroundMediaEditor.tsx](../../clicker-platform-v2/components/admin/blocks/BackgroundMediaEditor.tsx)
- Existing type: [data/mockData.ts](../../clicker-platform-v2/data/mockData.ts) (`BackgroundMediaBase`, `BackgroundMedia`)
- Canvas Studio entry: [components/admin/blocks/CanvasStudio.tsx](../../clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx)
- Architecture rules: [CLAUDE.md](../../CLAUDE.md), [clicker-platform-v2/docs/ARCHITECTURE.md](../../clicker-platform-v2/docs/ARCHITECTURE.md)

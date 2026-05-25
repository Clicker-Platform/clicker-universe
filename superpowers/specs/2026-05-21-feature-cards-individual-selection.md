# Feature Cards — Individual Card Selection

**Date:** 2026-05-21
**Status:** Spec approved, awaiting implementation plan
**Block:** `DefaultFeatureCardsBlock` (`components/blocks/public/DefaultFeatureCardsBlock.tsx`)
**Pattern reference:** Hero block — selecting a sub-element (Button) on the canvas shows a selection ring, floating mini-toolbar, and focuses the corresponding fields in the right sidebar.

---

## 1. Goal

Enable individual selection of a single card inside the Feature Cards block on the canvas. Selecting a card:

1. Draws a blue selection ring around just that card.
2. Shows a floating mini-toolbar above the selected card with quick actions (reorder, delete).
3. Auto-expands and focuses the corresponding card's panel in the right sidebar (Headline input receives keyboard focus).

This mirrors the existing Hero → Button selection pattern. Editing of text still happens in the right sidebar inputs — **inline contenteditable text editing is explicitly out of scope.**

---

## 2. Selection Model

Extend `EditorContext.selection` (the discriminated union per `superpowers/specs/2026-05-16-editor-selection-model.md`) with a new variant:

```ts
| { kind: 'block-child'; blockId: string; childPath: { type: 'card'; cardId: string } }
```

### Selection transitions

| User action | Resulting selection |
|---|---|
| Click a card inside a Feature Cards block | `{ kind: 'block-child', blockId, childPath: { type: 'card', cardId } }` |
| Click the Feature Cards block background (outside any card) | `{ kind: 'block', blockId }` |
| Click a different block | That block's selection; card selection cleared |
| Click empty canvas / Escape | Cleared |
| Delete the selected card | Selection falls back to the parent block |

Add a helper to `EditorContext`:

```ts
selectCardChild(blockId: string, cardId: string): void
```

---

## 3. Visual Affordance on Canvas

When a card is selected (admin canvas only — gated by `previewMode`):

- **Selection ring** — `ring-2 ring-blue-500` on the card wrapper (`cardWrapperClass` div around `<CardItem />` in `DefaultFeatureCardsBlock.tsx`).
- **Suppress parent ring** — while a child is selected, the outer block ring is not drawn (avoid double rings). Existing block-selection logic in `BlockRenderer` / `SafeBlockRenderer` reads the selection union and skips its own ring when `selection.kind === 'block-child' && selection.blockId === thisBlockId`.
- **Hover ring** on un-selected cards uses the existing block-hover style.
- **Floating mini-toolbar** anchored above the selected card. Visual parity with Hero button toolbar:
  - Leading label: `Card #N` (1-indexed by position)
  - ↑ Move up — disabled when first
  - ↓ Move down — disabled when last
  - 🗑 Delete
- **Public site** — none of the above renders; this is admin-only.

### New component

`components/admin/blocks/inline/CardToolbar.tsx` — small, reusable toolbar styled like the existing Hero button toolbar. Props:

```ts
interface CardToolbarProps {
  label: string;        // "Card #1"
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp(): void;
  onMoveDown(): void;
  onDelete(): void;
}
```

Reusable later for other list-of-items blocks (FAQ, ImageGallery) but ship FeatureCards-only first.

---

## 4. Right Sidebar Behavior

The Feature Cards form (currently rendered via `BlockFormRenderer` — exact filename TBD by current code; likely `forms/FeatureCardsForm.tsx` or equivalent) already lists cards. When a card is selected:

- The form reads the selected `cardId` from `useEditor().selection`.
- The matching card's panel auto-expands; siblings collapse if the form uses an accordion pattern, otherwise the matching panel is scrolled into view.
- The **Headline** input inside that panel receives keyboard focus on selection change (`useEffect` watching `cardId` + `inputRef.current?.focus()`).
- Existing Add / Reorder / Delete controls in the sidebar remain functional and stay in sync with the canvas toolbar (both mutate the same `data.cards` array via `updateBlockData`).

When the selection is the block itself (not a card), the form returns to its default state — no auto-expand, no auto-focus.

---

## 5. Files Touched

**Selection plumbing**
- `components/admin/blocks/EditorContext.tsx` — extend `selection` union; add `selectCardChild(blockId, cardId)`; ensure cross-block clicks clear child selection.

**Block rendering**
- `components/blocks/BlockRenderer.tsx` / `components/blocks/SafeBlockRenderer.tsx` — suppress the outer block ring when a child of this block is selected.
- `components/blocks/public/DefaultFeatureCardsBlock.tsx` — in `previewMode`:
  - Add per-card `onClick` → `selectCardChild`
  - Render selection ring on matching card wrapper
  - Render `<CardToolbar />` above the selected card

**New file**
- `components/admin/blocks/inline/CardToolbar.tsx` — floating toolbar component.

**Form**
- The Feature Cards form file (verify exact path during implementation — likely `components/admin/blocks/forms/FeatureCardsForm.tsx`):
  - Read selected `cardId` from `useEditor()`
  - Auto-expand + scroll-into-view the matching panel
  - Focus the Headline input on selection change

**No data model changes** — `FeatureCard.id` already exists.

---

## 6. Out of Scope (Explicit)

- Inline contenteditable text editing on the canvas — separate, platform-wide future project.
- Drag-to-reorder cards on the canvas — sidebar reorder is unchanged.
- Sub-selection for tags, label, body, or media within a card.
- Extending the pattern to other list-of-items blocks (FAQ, ImageGallery, Social Embed) — same pattern will work but is not part of this scope.

---

## 7. Success Criteria

- Clicking any card in `DefaultFeatureCardsBlock` on the admin canvas selects only that card with a single blue ring.
- The floating `CardToolbar` appears above the selected card with the correct label and enabled/disabled reorder buttons.
- Move-up, move-down, and delete from the toolbar mutate `data.cards` and the canvas re-renders.
- The right sidebar Feature Cards form auto-expands the selected card's panel and focuses the Headline input within ~one render frame of the selection change.
- Clicking the block background, another block, or empty canvas clears card selection per §2.
- Public-site rendering of Feature Cards is unchanged.

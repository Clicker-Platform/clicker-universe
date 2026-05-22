# Feature Cards — Individual Card Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable click-to-select for individual cards inside the Feature Cards block on the admin canvas, with a floating mini-toolbar and right-sidebar auto-focus on the selected card's properties.

**Architecture:** Reuse the existing `EditorSelection` `slots` variant (`{ kind: 'slots'; containerId; ids }`) for sub-element selection. `containerId` = the FeatureCards block id; `ids[0]` = the card id. This piggybacks on existing right-sidebar routing in `CanvasStudio.tsx` that already dispatches `slots` selections back to the container's form. No new union variant needed. A new `<CardToolbar />` admin component renders the floating quick-actions above the selected card.

**Tech Stack:** Next.js / React (client components only), Tailwind CSS, existing `EditorContext`, `lucide-react` icons.

**Spec:** [`superpowers/specs/2026-05-21-feature-cards-individual-selection.md`](../specs/2026-05-21-feature-cards-individual-selection.md)

---

## File Structure

**New files**
- `clicker-platform-v2/components/admin/blocks/inline/CardToolbar.tsx` — small floating toolbar (label + ↑/↓/🗑) positioned above the selected card.

**Modified files**
- `clicker-platform-v2/components/admin/blocks/SelectableBlock.tsx` — add `feature_cards` to `allowsPointerEvents` so card clicks reach the public block; suppress outer ring when a child slot of this block is selected.
- `clicker-platform-v2/components/blocks/public/DefaultFeatureCardsBlock.tsx` — accept `containerBlockId` + `previewMode`; per-card click handler writes `{ kind: 'slots', containerId, ids: [cardId] }`; selection ring + `<CardToolbar />` on the selected card.
- `clicker-platform-v2/components/blocks/BlockRenderer.tsx` — pass `containerBlockId={block.id}` and `previewMode` to FeatureCardsBlock.
- `clicker-platform-v2/components/admin/blocks/forms/FeatureCardsForm.tsx` — read selection from `useEditor()`; if a card in this block is selected, force that card's `CardItem` expanded, collapse the rest, scroll-into-view, focus the Headline input.

---

## Important Context for the Implementing Engineer

**Selection model is already in place.** `EditorContext.selection` is a discriminated union (`components/admin/blocks/EditorContext.tsx`). The `slots` variant is already used by Columns and Grid for nested cells. The right sidebar in `CanvasStudio.tsx:701-723` already routes `kind: 'slots'` selections to `BlockFormRenderer` for the container block. **Do not add a new union variant** — reuse `slots`.

**Public-site safety.** `DefaultFeatureCardsBlock` is also rendered on the public site (no `EditorProvider`). Use `useContext(EditorContext)` directly (returns `undefined` on the public site) and gate all admin behavior on `editor && previewMode`. This matches the pattern in `DefaultColumnsBlock.tsx:30,45`.

**Pointer-events gotcha.** `SelectableBlock` (the wrapper around every top-level block on canvas) wraps non-interactive blocks in `pointer-events-none` so clicks bubble up to it. FeatureCards is not currently in the `allowsPointerEvents` allowlist (`SelectableBlock.tsx:85-90`), so per-card clicks would be swallowed by the outer wrapper. **Add `feature_cards` to the allowlist** AND have the card `onClick` call `e.stopPropagation()` so the click does not also re-select the parent block.

**Outer ring suppression.** When a child slot is selected, the outer block ring should not draw (avoids double rings). `SelectableBlock` currently shows its chrome whenever `selection.kind === 'blocks' && selection.ids.includes(blockId)`. We need an additional case: hide chrome when `selection.kind === 'slots' && selection.containerId === blockId`.

**No unit tests in this repo for canvas blocks today.** This codebase does not have Vitest tests for the public block components — verification is by running the dev server and clicking through. Each task ends with manual verification steps, not `pnpm test`.

**Working directory.** All paths below are relative to `clicker-platform-v2/` unless otherwise noted.

---

## Task 1: Add `feature_cards` to SelectableBlock pointer-events allowlist

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/SelectableBlock.tsx:85-90`

- [ ] **Step 1: Add `feature_cards` to the allowlist**

In `SelectableBlock.tsx`, the `allowsPointerEvents` constant currently reads:

```tsx
const allowsPointerEvents =
    blockType === 'social_embed' ||
    blockType === 'hero' ||
    blockType === 'heading' ||
    blockType === 'columns' ||
    blockType === 'grid';
```

Change it to:

```tsx
const allowsPointerEvents =
    blockType === 'social_embed' ||
    blockType === 'hero' ||
    blockType === 'heading' ||
    blockType === 'columns' ||
    blockType === 'grid' ||
    blockType === 'feature_cards';
```

- [ ] **Step 2: Suppress outer chrome when a card child is selected**

In the same file (around line 59), the chrome currently renders based on:

```tsx
const isSelected = selection.kind === 'blocks' && selection.ids.includes(blockId);
```

Add a sibling derivation and use it to hide the chrome when a child slot is active:

```tsx
const isSelected = selection.kind === 'blocks' && selection.ids.includes(blockId);
const hasChildSelection = selection.kind === 'slots' && selection.containerId === blockId;
```

Then in the JSX (`<SelectionChrome selected={isSelected} hoverGuide={showGuides && !isSelected} />`), update both props to also account for `hasChildSelection`:

```tsx
<SelectionChrome
    selected={isSelected}
    hoverGuide={showGuides && !isSelected && !hasChildSelection}
/>
```

We keep `selected={isSelected}` (we want the parent ring suppressed only — the chrome handles the full block; it does not draw when not selected). The hover dashed outline must also disappear so the child selection ring is the only blue line visible.

- [ ] **Step 3: Verify manually**

Run the dev server (`cd clicker-platform-v2 && pnpm dev`), open `/admin/canvas`, add a Feature Cards block. Click anywhere on the block background → outer blue ring + chrome appears (block selected). This confirms the outer behavior still works. Card-level selection is wired in later tasks.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/SelectableBlock.tsx
git commit -m "feat(canvas): allow feature_cards pointer events and suppress parent ring on child selection"
```

---

## Task 2: Create the CardToolbar component

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/inline/CardToolbar.tsx`

- [ ] **Step 1: Create the directory if it does not exist**

```bash
mkdir -p clicker-platform-v2/components/admin/blocks/inline
```

- [ ] **Step 2: Write `CardToolbar.tsx`**

Create the file with this exact contents:

```tsx
'use client';

import React from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

interface CardToolbarProps {
    /** Display label like "Card #1". */
    label: string;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDelete: () => void;
}

/**
 * Floating mini-toolbar shown above the currently selected child card on the
 * canvas. Visual parity with the Hero block's inline button toolbar.
 *
 * Positioning is the caller's responsibility — render this absolutely
 * positioned relative to the card wrapper (top-aligned, slightly above).
 */
export function CardToolbar({
    label,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onDelete,
}: CardToolbarProps) {
    const stop = (fn: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        fn();
    };

    const btn =
        'p-1.5 rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 ' +
        'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-600 ' +
        'transition-colors';

    return (
        <div
            // Stop clicks on the toolbar from re-selecting the parent block.
            onClick={(e) => e.stopPropagation()}
            className="
                absolute -top-9 left-0 z-30
                flex items-center gap-0.5
                px-1.5 py-1
                bg-white rounded-lg shadow-md border border-neutral-200
                text-xs font-medium
            "
        >
            <span className="px-2 py-0.5 text-neutral-700 select-none">{label}</span>
            <span className="w-px h-4 bg-neutral-200 mx-0.5" />
            <button
                type="button"
                aria-label="Move up"
                disabled={!canMoveUp}
                onClick={stop(onMoveUp)}
                className={btn}
            >
                <ChevronUp size={14} />
            </button>
            <button
                type="button"
                aria-label="Move down"
                disabled={!canMoveDown}
                onClick={stop(onMoveDown)}
                className={btn}
            >
                <ChevronDown size={14} />
            </button>
            <span className="w-px h-4 bg-neutral-200 mx-0.5" />
            <button
                type="button"
                aria-label="Delete card"
                onClick={stop(onDelete)}
                className={`${btn} hover:text-red-600`}
            >
                <Trash2 size={13} />
            </button>
        </div>
    );
}
```

- [ ] **Step 3: Verify it compiles**

Run:

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/inline/CardToolbar.tsx
git commit -m "feat(canvas): add CardToolbar component for inline card actions"
```

---

## Task 3: Pass `containerBlockId` + `previewMode` to FeatureCardsBlock from BlockRenderer

**Files:**
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx:215-216`

- [ ] **Step 1: Update the case in `BlockRenderer.tsx`**

Find the `feature_cards` case (around line 215):

```tsx
case 'feature_cards':
    return <FeatureCardsBlock data={block.data} theme={theme} previewMode={previewMode} />;
```

Change to:

```tsx
case 'feature_cards':
    return (
        <FeatureCardsBlock
            data={block.data}
            theme={theme}
            previewMode={previewMode}
            containerBlockId={block.id}
        />
    );
```

- [ ] **Step 2: Verify it compiles**

Run:

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```

Expected: a type error from `DefaultFeatureCardsBlock` — `containerBlockId` is not in its props yet. That's expected; Task 4 adds it. You may leave this commit-uncommitted until Task 4 lands, OR commit now and fix together — pick whichever you prefer.

If you want a clean intermediate state, do not commit yet and proceed to Task 4. The commit at the end of Task 4 will cover both files.

---

## Task 4: Wire individual card selection in DefaultFeatureCardsBlock

**Files:**
- Modify: `clicker-platform-v2/components/blocks/public/DefaultFeatureCardsBlock.tsx`

- [ ] **Step 1: Add imports**

At the top of `DefaultFeatureCardsBlock.tsx`, alongside the existing imports, add:

```tsx
import { useContext } from 'react';
import { EditorContext } from '@/components/admin/blocks/EditorContext';
import { CardToolbar } from '@/components/admin/blocks/inline/CardToolbar';
```

`React` is already imported at the top of the file; merge `useContext` into that import if you prefer (`import React, { useContext } from 'react';`).

- [ ] **Step 2: Extend the props interface**

Find:

```tsx
interface DefaultFeatureCardsBlockProps {
    data: FeatureCardsData;
    theme?: any;
    previewMode?: boolean;
}
```

Replace with:

```tsx
interface DefaultFeatureCardsBlockProps {
    data: FeatureCardsData;
    theme?: any;
    previewMode?: boolean;
    /** Set by BlockRenderer in admin canvas. Used as `selection.containerId`
     *  when a child card is selected. Undefined on the public site. */
    containerBlockId?: string;
}
```

- [ ] **Step 3: Destructure the new prop in the component signature**

Find:

```tsx
export function DefaultFeatureCardsBlock({ data, theme: themeProp, previewMode: _previewMode }: DefaultFeatureCardsBlockProps) {
```

Replace with:

```tsx
export function DefaultFeatureCardsBlock({ data, theme: themeProp, previewMode, containerBlockId }: DefaultFeatureCardsBlockProps) {
```

(Note: rename `_previewMode` → `previewMode`. It is now actually used.)

- [ ] **Step 4: Read editor selection inside the component**

Right after the existing `const deviceView = useDeviceView();` line (before the `if (!data) return null;` guard), add:

```tsx
    // Context-safe: undefined on the public site where no EditorProvider is mounted.
    const editor = useContext(EditorContext);
    const isAdminCanvas = !!(editor && previewMode && containerBlockId);

    const selectedCardId: string | null =
        isAdminCanvas
        && editor!.selection.kind === 'slots'
        && editor!.selection.containerId === containerBlockId
        && editor!.selection.ids.length === 1
            ? editor!.selection.ids[0]
            : null;
```

- [ ] **Step 5: Make each card clickable + add selection ring + toolbar**

Find the existing card map block:

```tsx
{cards.length > 0 && (
    <div className={containerClass}>
        {cards.map((card) => {
            const cardWrapperClass = dv(
                deviceView,
                'snap-start shrink-0 w-[72vw] max-w-[280px] flex flex-col',
                'md:w-auto md:max-w-none flex flex-col'
            );
            return (
                <div key={card.id} className={cardWrapperClass}>
                    <CardItem card={card} cardStyle={theme?.cardStyle} theme={theme} />
                </div>
            );
        })}
    </div>
)}
```

Replace it with:

```tsx
{cards.length > 0 && (
    <div className={containerClass}>
        {cards.map((card, index) => {
            const cardWrapperBase = dv(
                deviceView,
                'snap-start shrink-0 w-[72vw] max-w-[280px] flex flex-col',
                'md:w-auto md:max-w-none flex flex-col'
            );

            const isSelected = selectedCardId === card.id;
            const selectionRing = isAdminCanvas && isSelected
                ? 'ring-2 ring-blue-500 rounded-2xl'
                : '';

            const handleClick = isAdminCanvas
                ? (e: React.MouseEvent) => {
                    e.stopPropagation();
                    editor!.setSelection({
                        kind: 'slots',
                        containerId: containerBlockId!,
                        ids: [card.id],
                    });
                }
                : undefined;

            const handleMoveUp = () => {
                const next = [...cards];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                editor!.updateBlockData(containerBlockId!, { cards: next });
            };
            const handleMoveDown = () => {
                const next = [...cards];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                editor!.updateBlockData(containerBlockId!, { cards: next });
            };
            const handleDelete = () => {
                const next = cards.filter((_, i) => i !== index);
                editor!.updateBlockData(containerBlockId!, { cards: next });
                // Drop the now-stale selection back to the parent block.
                editor!.setSelection({ kind: 'blocks', ids: [containerBlockId!] });
            };

            return (
                <div
                    key={card.id}
                    onClick={handleClick}
                    className={`${cardWrapperBase} relative ${selectionRing} ${isAdminCanvas ? 'cursor-pointer' : ''}`}
                >
                    {isAdminCanvas && isSelected && (
                        <CardToolbar
                            label={`Card #${index + 1}`}
                            canMoveUp={index > 0}
                            canMoveDown={index < cards.length - 1}
                            onMoveUp={handleMoveUp}
                            onMoveDown={handleMoveDown}
                            onDelete={handleDelete}
                        />
                    )}
                    <CardItem card={card} cardStyle={theme?.cardStyle} theme={theme} />
                </div>
            );
        })}
    </div>
)}
```

- [ ] **Step 6: Verify it compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual verification**

```bash
cd clicker-platform-v2 && pnpm dev
```

Open `/admin/canvas`, add a Feature Cards block with at least 3 cards. Verify:
1. Clicking a single card draws a blue selection ring around just that card.
2. The floating `Card #N` toolbar appears above the selected card.
3. Up/Down reorder the cards. The toolbar follows the card to its new position.
4. Trash removes the card and the selection falls back to the parent block (block ring reappears).
5. Clicking another card moves the selection — no double rings.
6. Clicking outside the block (the page background or another block) clears card selection.

If reordering is glitchy or the selection ring lags, that is expected at this step — the right-sidebar form does not yet react to card selection. Task 5 handles that.

- [ ] **Step 8: Commit**

```bash
git add clicker-platform-v2/components/blocks/BlockRenderer.tsx \
        clicker-platform-v2/components/blocks/public/DefaultFeatureCardsBlock.tsx
git commit -m "feat(canvas): individual card selection + inline toolbar for feature_cards"
```

---

## Task 5: Auto-expand and focus the selected card in FeatureCardsForm

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/forms/FeatureCardsForm.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add:

```tsx
import { useEffect, useRef } from 'react';
import { useEditor } from '@/components/admin/blocks/EditorContext';
```

`useState` is already imported (line 4). Merge the new hooks into that import line if you prefer (`import { useState, useEffect, useRef } from 'react';`).

- [ ] **Step 2: Make `CardItem` controllable**

`CardItem` currently owns `expanded` as local state. Convert it to a controlled prop so the parent (`FeatureCardsForm`) can force-expand the selected card. Find the `CardItem` signature:

```tsx
function CardItem({ card, index, total, onChange, onDelete, onMove }: {
    card: FeatureCard;
    index: number;
    total: number;
    onChange: (card: FeatureCard) => void;
    onDelete: () => void;
    onMove: (dir: 'up' | 'down') => void;
}) {
    const [expanded, setExpanded] = useState(true);
```

Replace with:

```tsx
function CardItem({
    card,
    index,
    total,
    expanded,
    onToggleExpanded,
    onChange,
    onDelete,
    onMove,
    headlineRef,
}: {
    card: FeatureCard;
    index: number;
    total: number;
    expanded: boolean;
    onToggleExpanded: () => void;
    onChange: (card: FeatureCard) => void;
    onDelete: () => void;
    onMove: (dir: 'up' | 'down') => void;
    headlineRef?: React.RefObject<HTMLInputElement>;
}) {
```

Remove the now-unused `useState` line inside `CardItem`. Replace the existing toggle handler:

```tsx
<button type="button" onClick={() => setExpanded(e => !e)} className="flex-1 flex items-center gap-2 text-left">
```

with:

```tsx
<button type="button" onClick={onToggleExpanded} className="flex-1 flex items-center gap-2 text-left">
```

And on the Headline input, attach the ref. Find:

```tsx
<input value={card.headline} onChange={e => set('headline', e.target.value)} className={inputClass} placeholder="Card Headline" />
```

Replace with:

```tsx
<input ref={headlineRef} value={card.headline} onChange={e => set('headline', e.target.value)} className={inputClass} placeholder="Card Headline" />
```

- [ ] **Step 3: Track expanded set + selected card in `FeatureCardsForm`**

Inside `FeatureCardsForm`, before the existing `safeData` derivation, add:

```tsx
    const { selection } = useEditor();

    const selectedCardId: string | null =
        selection.kind === 'slots' && selection.ids.length === 1
            ? selection.ids[0]
            : null;

    // Default behavior preserved: all cards start expanded. We track collapsed
    // state as an explicit set so selection-driven expand always wins.
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const toggleExpanded = (cardId: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(cardId)) next.delete(cardId);
            else next.add(cardId);
            return next;
        });
    };

    const headlineRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const cardItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // When a card is selected on the canvas: expand it, scroll it into view,
    // focus its Headline input.
    useEffect(() => {
        if (!selectedCardId) return;
        // Force-expand: remove from the collapsed set.
        setCollapsed(prev => {
            if (!prev.has(selectedCardId)) return prev;
            const next = new Set(prev);
            next.delete(selectedCardId);
            return next;
        });
        // Run scroll + focus after the panel has had a chance to render its expanded body.
        const id = requestAnimationFrame(() => {
            cardItemRefs.current[selectedCardId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            headlineRefs.current[selectedCardId]?.focus();
        });
        return () => cancelAnimationFrame(id);
    }, [selectedCardId]);
```

- [ ] **Step 4: Wrap each `CardItem` render with a ref-holding div and pass the new props**

Find the existing `.map`:

```tsx
{safeData.cards.map((card, i) => (
    <CardItem
        key={card.id}
        card={card}
        index={i}
        total={safeData.cards.length}
        onChange={c => updateCard(i, c)}
        onDelete={() => deleteCard(i)}
        onMove={dir => moveCard(i, dir)}
    />
))}
```

Replace with:

```tsx
{safeData.cards.map((card, i) => (
    <div
        key={card.id}
        ref={(el) => { cardItemRefs.current[card.id] = el; }}
    >
        <CardItem
            card={card}
            index={i}
            total={safeData.cards.length}
            expanded={!collapsed.has(card.id)}
            onToggleExpanded={() => toggleExpanded(card.id)}
            onChange={c => updateCard(i, c)}
            onDelete={() => deleteCard(i)}
            onMove={dir => moveCard(i, dir)}
            headlineRef={{ current: headlineRefs.current[card.id] ?? null } as React.RefObject<HTMLInputElement>}
        />
    </div>
))}
```

That `headlineRef={...}` form does not work for assigning refs across renders. Use a callback-ref pattern instead. Replace the `headlineRef` prop value above with `undefined` for now and instead pass it as a callback ref by inlining at the input. The cleanest approach: change `CardItem` to accept a callback `registerHeadlineRef: (el: HTMLInputElement | null) => void` and call it in the input's `ref`. Apply this corrected version:

In `CardItem` signature, replace `headlineRef?: React.RefObject<HTMLInputElement>` with:

```tsx
    registerHeadlineRef?: (el: HTMLInputElement | null) => void;
```

In the Headline input inside `CardItem`, change:

```tsx
<input ref={headlineRef} value={card.headline} ... />
```

to:

```tsx
<input
    ref={(el) => { registerHeadlineRef?.(el); }}
    value={card.headline}
    onChange={e => set('headline', e.target.value)}
    className={inputClass}
    placeholder="Card Headline"
/>
```

Then in the `.map` in `FeatureCardsForm`, pass:

```tsx
registerHeadlineRef={(el) => { headlineRefs.current[card.id] = el; }}
```

instead of the broken `headlineRef={...}` line. Final `.map` block:

```tsx
{safeData.cards.map((card, i) => (
    <div
        key={card.id}
        ref={(el) => { cardItemRefs.current[card.id] = el; }}
    >
        <CardItem
            card={card}
            index={i}
            total={safeData.cards.length}
            expanded={!collapsed.has(card.id)}
            onToggleExpanded={() => toggleExpanded(card.id)}
            onChange={c => updateCard(i, c)}
            onDelete={() => deleteCard(i)}
            onMove={dir => moveCard(i, dir)}
            registerHeadlineRef={(el) => { headlineRefs.current[card.id] = el; }}
        />
    </div>
))}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual verification**

```bash
cd clicker-platform-v2 && pnpm dev
```

In `/admin/canvas` with a Feature Cards block containing 3+ cards:

1. Click a card on canvas → the right sidebar's matching card panel is expanded; if it was off-screen, the form scrolls to it; the Headline input is focused (cursor visible inside it).
2. Type — the headline updates on the canvas live.
3. Click a different card → its panel expands and Headline focuses. Previous card's expanded/collapsed state is preserved.
4. Manually click the chevron on a panel header → it toggles independently of selection.
5. Select the block (not a specific card) → no auto-focus behavior; cards retain whatever expanded state the user last set.
6. Delete a card from the canvas toolbar → the form re-renders without that panel.

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/FeatureCardsForm.tsx
git commit -m "feat(canvas): auto-expand and focus selected card in FeatureCardsForm"
```

---

## Task 6: End-to-end smoke + cleanup pass

**Files:** none (verification only)

- [ ] **Step 1: Full dev-server smoke test**

```bash
cd clicker-platform-v2 && pnpm dev
```

Walk the success criteria from the spec (`superpowers/specs/2026-05-21-feature-cards-individual-selection.md` §7) one by one:

1. ✅ Clicking any card in `DefaultFeatureCardsBlock` on the admin canvas selects only that card with a single blue ring.
2. ✅ The floating `CardToolbar` appears above the selected card with the correct label and enabled/disabled reorder buttons.
3. ✅ Move-up, move-down, and delete from the toolbar mutate `data.cards` and the canvas re-renders.
4. ✅ The right sidebar Feature Cards form auto-expands the selected card's panel and focuses the Headline input within ~one render frame of the selection change.
5. ✅ Clicking the block background, another block, or empty canvas clears card selection.
6. ✅ Public-site rendering of Feature Cards is unchanged — visit a published page that uses the block and confirm no rings, no toolbar, no click affordance.

- [ ] **Step 2: Lint + type-check pass**

```bash
cd clicker-platform-v2 && pnpm lint && pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: If anything failed**

Fix it in a follow-up commit. Do not amend earlier commits.

- [ ] **Step 4: Done**

If everything in Step 1 passes, the feature is complete.

---

## Self-Review Notes

- **Spec coverage:** §2 (selection model) → Task 1 + Task 4. §3 (visual affordance) → Task 2 + Task 4. §4 (sidebar behavior) → Task 5. §5 (files touched) → all tasks. §7 (success criteria) → Task 6.
- **Spec deviation:** Spec §2 proposed a new `block-child` union variant. The plan reuses the existing `slots` variant instead — this is simpler, requires no `EditorContext` changes, and piggybacks on existing right-sidebar routing in `CanvasStudio.tsx:701`. Equivalent semantics, less code. Worth noting in the eventual commit/PR description.
- **Type names:** `CardToolbarProps`, `DefaultFeatureCardsBlockProps`, `registerHeadlineRef` consistent across tasks.
- **No placeholders:** all code blocks complete; all paths absolute; all verification steps concrete.
